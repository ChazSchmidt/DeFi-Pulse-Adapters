/*==================================================
  Modules
==================================================*/

const { api: { abi, util }, util: utilBase } = require('../../sdk');

/*==================================================
  Settings
==================================================*/

const START_BLOCK = 9340147;
const PROTOCOL_ADDRESS = '0x6F400810b62df8E13fded51bE75fF5393eaa841F';
/* 
* Tokens on GP to ignore
[ 
    0x7cac16770dd5f2a59859a395a492224f05a846b6: "oETH Put $200 29/05/2020",
]
*/
const TOKENS_TO_IGNORE = new Set(['0x7cac16770dd5f2a59859a395a492224f05a846b6']);

/*==================================================
  Helper Functions
==================================================*/

const getTokenAddressFromLogData = data => '0x' + data.substring(26, 66);

const getCallDataOfErc20Token = (tokenAddress, atThisBlock) => 
  ({ 
    target: tokenAddress, 
    params: PROTOCOL_ADDRESS, 
    abi: 'erc20:balanceOf', 
    block: atThisBlock, 
  });

/*==================================================
  Main
==================================================*/

async function tvl(_, block) {
  // Snag all token addresses that have been listed on GP
  const { output: events } = await util.getLogs({
    keys: [],
    toBlock: block,
    target: PROTOCOL_ADDRESS,
    fromBlock: START_BLOCK,
    topic: 'TokenListing(address,uint16)',
  });

  // 1. Reduce all TokenListing logs into an array of token addresses from the log data
  // 2. Remove any tokens we want to ignore as denoted top of file
  // 3. Format to pipe into erc20:balanceOf multiCall
  const tokenList =
    events
      .reduce((acc, { data }) => {
        const tokenAddress = getTokenAddressFromLogData(data);
        if (TOKENS_TO_IGNORE.has(tokenAddress)) return acc;

        const tokenWithCallData = getCallDataOfErc20Token(tokenAddress, block);
        return acc.concat(tokenWithCallData)
      }, []);

  // [0] Batch call all ERC20 balances from the G-Protocol
  // [1] Resolve initial ethBalance promise
  const erc20Balances = await abi.multiCall({
      block,
      abi: 'erc20:balanceOf',
      calls: tokenList
    });

  const balances = {
    // GP only accepts WETH
    '0x0000000000000000000000000000000000000000': '0',
  };

  utilBase.sumMultiBalanceOf(balances, erc20Balances);

  return (await util.toSymbols(balances)).output;
}

/*==================================================
  Exports
==================================================*/

module.exports = {
  name: 'Gnosis Protocol',
  category: 'DEXes',
  token: 'OWL',
  start: 1579811423, // Thu, 23 Jan 2020 20:30:23 GMT
  tvl,
};
