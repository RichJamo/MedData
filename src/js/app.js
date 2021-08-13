const SUSHI_ADDRESS = "0x0b3f868e0be5597d5db7feb59e1cadbb0fdda50a"
const WBTC_ADDRESS = "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6"
const WETH_ADDRESS = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619"
const WMATIC_ADDRESS = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270"
const USDC_ADDRESS = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"

const QUICKSWAP_ROUTER = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"
const SUSHISWAP_ROUTER = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"
const BENTOBOX_MASTER_CONTRACT_ADDRESS = "0x0319000133d3AdA02600f0875d2cf03D442C3367";
const BENTOBOX_BALANCER_DAPP_ADDRESS = "0x9c4fCF15580507f2F13De3b769119b52A7bB9473"; //insert the address I deployed to

const MATIC_USD_ORACLE = "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0"
const BTC_USD_ORACLE = "0xc907E116054Ad103354f2D350FD2514433D57F6f"
const ETH_USD_ORACLE = "0xF9680D99D6C9589e2a93a78A04A279e509205945"
const SUSHI_USD_ORACLE = "0x49b0c695039243bbfeb8ecd054eb70061fd54aa0"

var user;
/*****************************************/
/* Detect the MetaMask Ethereum provider */
/*****************************************/
const provider = new ethers.providers.Web3Provider(window.ethereum)
const signer = provider.getSigner()

//check that we are connected to Polygon/Matic network
var chainId = await checkNetworkId(provider)
if (chainId !== 137) {
  console.log("Please change to Matic network") //TODO make this an alert to the user...
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x89' }], //137 in 0x padded hexadecimal form is 0x89
    });
    window.location.reload();
  } catch (switchError) {
    // This error code indicates that the chain has not been added to MetaMask.
    if (error.code === 4902) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{ chainId: '0x89', rpcUrl: 'https://rpc-mainnet.maticvigil.com/' /* ... */ }],
        });
      } catch (addError) {
        // handle "add" error
      }
    }
    // handle other "switch" errors
  }
}

const confirmSwapButton = document.getElementById('confirmSwap');

if (provider) {
  startApp(provider); // Initialize your app
} else {
  console.log('Please install MetaMask!');
}

async function checkNetworkId(_provider) {
  try {
    var network = await provider.getNetwork();
    return network["chainId"];
  }
  catch (error) {
    console.log(error);
  }
}

async function startApp(provider) {
  //Basic Actions Section
  // const onboardButton = document.getElementById('connectButton'); - come back to this later - for checking if metamask installed
  const ApproveMasterContractButton = document.getElementById('ApproveMasterContract') //ok to have same name for id and variable?
  const depositButton = document.getElementById('depositButton');
  const approveButton = document.getElementById('approveButton');

  // const approveDepositFromDappButton = document.getElementById('approveDepositFromDapp');
  const swapAndRedepositButton = document.getElementById('swapAndRedeposit');
  const withdrawToUserButton = document.getElementById('withdraw_BB_to_user');

  const accounts = await ethereum.request({ method: 'eth_accounts' });
  user = accounts[0];

  await displayBalances();
  await displayUSDBalances();

  ApproveMasterContractButton.addEventListener('click', async () => {
    var BentoMasterContract = new ethers.Contract(BENTOBOX_MASTER_CONTRACT_ADDRESS, bento_abi, signer);

    const masterContract = BENTOBOX_BALANCER_DAPP_ADDRESS;
    // library: ethers.providers.Web3Provider,
    const approved = true;
    const chainId = 137;

    const warning = approved ? 'Give FULL access to funds in (and approved to) BentoBox?' : 'Revoke access to BentoBox?';
    const nonce = await BentoMasterContract.nonces(user);

    const message = {
      warning,
      user,
      masterContract,
      approved,
      nonce,
    };

    const domain = {
      name: 'BentoBox V1',
      chainId: chainId,
      verifyingContract: BENTOBOX_MASTER_CONTRACT_ADDRESS
    };

    const types = {
      SetMasterContractApproval: [
        { name: 'warning', type: 'string' },
        { name: 'user', type: 'address' },
        { name: 'masterContract', type: 'address' },
        { name: 'approved', type: 'bool' },
        { name: 'nonce', type: 'uint256' }
      ]
    };

    // const primaryType = 'SetMasterContractApproval'; //do we need this?

    const signature = await signer._signTypedData(domain, types, message);
    console.log(signature);
    const { r, s, v } = ethers.utils.splitSignature(signature);
    console.log(r);
    console.log(s);
    console.log(v);

    await BentoMasterContract.setMasterContractApproval(
      user, //user
      BENTOBOX_BALANCER_DAPP_ADDRESS, //master contract - 
      true, //isApproved
      v,// uint8 v
      r,// bytes32 r
      s // bytes32 s
    );
  })

  approveButton.addEventListener('click', async () => {
    var depositAmountUSDC = $("#depositAmountUSDC").val(); //put in some checks here? positive number, between x and y, user has enough funds...
    await giveApprovalFromUser(USDC_ADDRESS, BENTOBOX_MASTER_CONTRACT_ADDRESS, ethers.utils.parseUnits(depositAmountUSDC.toString(), 6));
  })

  depositButton.addEventListener('click', async () => {
    var depositAmountUSDC = $("#depositAmountUSDC").val(); //put in some checks here? positive number, between x and y, user has enough funds...
    var dappContract = new ethers.Contract(BENTOBOX_BALANCER_DAPP_ADDRESS, bento_dapp_abi, signer);
    dappContract.depositToBento(depositAmountUSDC * 10 ** 6, USDC_ADDRESS, user, BENTOBOX_BALANCER_DAPP_ADDRESS);
    //LISTEN FOR DEPOSIT EVENT TO BE EMITTED
    var BentoMasterContract = new ethers.Contract(BENTOBOX_MASTER_CONTRACT_ADDRESS, bento_abi, provider);
    var depositFilter = BentoMasterContract.filters.LogDeposit(USDC_ADDRESS, user, BENTOBOX_BALANCER_DAPP_ADDRESS); //very specific filter
    console.log("before the listener");
    BentoMasterContract.once(depositFilter, async (token, from, to, event) => {
      console.log("event triggered?");
      console.log(`${from} sent ${token} to ${to}`);
      //THEN WITHDRAW FROM BENTOBOX TO DAPP
      withdrawNewDepositFromBentoBoxToDapp(depositAmountUSDC * 10 ** 6) //need to change this to withdraw all available balance?
      //LISTEN FOR THAT EVENT TO BE EMITTED
      var withdrawFilter = BentoMasterContract.filters.LogWithdraw(USDC_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS); //very specific filter
      BentoMasterContract.once(withdrawFilter, async (token, from, to, event) => {
        console.log(`${from} sent ${token} to ${to}`);
        await swapUSDCintoFourTokensAndDepositBackToBB(depositAmountUSDC);
      })
    })
  })

  swapAndRedepositButton.addEventListener('click', async () => {
    await swapUSDCintoFourTokensAndDepositBackToBB($("#depositAmountUSDC").val());
  })

  // approveDepositFromDappButton.addEventListener('click', async () => {
  //   await giveApprovalFromDapp(WMATIC_ADDRESS, BENTOBOX_MASTER_CONTRACT_ADDRESS, ethers.utils.parseUnits("1.0", 18));
  // })
  // var tokenBalance;

  // depositFromDappButton.addEventListener('click', async () => {
  //   var dappContract = new ethers.Contract(BENTOBOX_BALANCER_DAPP_ADDRESS, bento_dapp_abi, signer);
  //   var tokenContract = new ethers.Contract(WMATIC_ADDRESS, token_abi, signer);
  //   tokenBalance = tokenContract.balanceOf(BENTOBOX_BALANCER_DAPP_ADDRESS);

  //   dappContract.depositToBento (tokenBalance, WMATIC_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS, user);
  // })

  withdrawToUserButton.addEventListener('click', async () => {
    var dappContract = new ethers.Contract(BENTOBOX_BALANCER_DAPP_ADDRESS, bento_dapp_abi, signer);
    dappContract.withdraw(999998, USDC_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS, user);
  })
}


/**********************************************************/
/* Handle chain (network) and chainChanged (per EIP-1193) */
/**********************************************************/

provider.on("network", (newNetwork, oldNetwork) => {
  // When a Provider makes its initial connection, it emits a "network"
  // event with a null oldNetwork along with the newNetwork. So, if the
  // oldNetwork exists, it represents a changing network
  if (oldNetwork) {
      window.location.reload();
  }
});

// const chainId = await ethereum.request({ method: 'eth_chainId' });
// // handleChainChanged(chainId);

// ethereum.on('chainChanged', handleChainChanged(chainId));

// function handleChainChanged(_chainId) {
//   // We recommend reloading the page, unless you must do otherwise
//   console.log("Chain has changed");
//   // window.location.reload();
// }

/***********************************************************/
/* Handle user accounts and accountsChanged (per EIP-1193) */
/***********************************************************/

let currentAccount = null;
ethereum
  .request({ method: 'eth_accounts' })
  .then(handleAccountsChanged)
  .catch((err) => {
    // Some unexpected error.
    // For backwards compatibility reasons, if no accounts are available,
    // eth_accounts will return an empty array.
    console.error(err);
  });

// Note that this event is emitted on page load.
// If the array of accounts is non-empty, you're already
// connected.
ethereum.on('accountsChanged', handleAccountsChanged);

// For now, 'eth_accounts' will continue to always return an array
function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    // MetaMask is locked or the user has not connected any accounts
    console.log('Please connect to MetaMask.');
  } else if (accounts[0] !== currentAccount) {
    currentAccount = accounts[0];
    // console.log(currentAccount.balanceOf()) - I tried this here, didn't work - what CAN I do here?
  }
}

/*********************************************/
/* Access the user's accounts (per EIP-1102) */
/*********************************************/

// // You should only attempt to request the user's accounts in response to user
// // interaction, such as a button click.
// // Otherwise, you popup-spam the user like it's 1999.
// // If you fail to retrieve the user's account(s), you should encourage the user
// // to initiate the attempt.
document.getElementById('connectButton', connect);

// While you are awaiting the call to eth_requestAccounts, you should disable
// any buttons the user can click to initiate the request.
// MetaMask will reject any additional requests while the first is still
// pending.
function connect() {
  ethereum
    .request({ method: 'eth_requestAccounts' })
    .then(handleAccountsChanged)
    .catch((err) => {
      if (err.code === 4001) {
        // EIP-1193 userRejectedRequest error
        // If this happens, the user rejected the connection request.
        console.log('Please connect to MetaMask.');
      } else {
        console.error(err);
      }
    });
}
$(document).ready(function () {
  console.log("any code here will implement first...")

})

async function balanceAndRemoveOneCoin(array_coins) {

  var swapInputs = getSwapInputs(array_coins);
  var token_to_be_swapped_address = swapInputs[2][0];
  var amount_to_be_swapped = swapInputs[0];

  var isApprovedForAmount = await checkIfApprovedForAmount(token_to_be_swapped_address, amount_to_be_swapped);
  var tokenToBeSwappedContract = new ethers.Contract(token_to_be_swapped_address, token_abi, signer);

  if (isApprovedForAmount) {
    console.log("token already approved");
    confirmAndExecuteSwapAndUpdateArrayAndDoNextSwap(amount_to_be_swapped, swapInputs, array_coins, tokenToBeSwappedContract)
  }

  else {
    console.log("token not already approved");

    askUserForApproval(token_to_be_swapped_address, amount_to_be_swapped);
    //create a listener for the approval confirmation
    var filterForApprovalEvent = tokenToBeSwappedContract.filters.Approval(BENTOBOX_BALANCER_DAPP_ADDRESS, null);
    tokenToBeSwappedContract.once(filterForApprovalEvent, async (owner, spender, value, event) => {
      console.log('Tokens approved');
      confirmAndExecuteSwapAndUpdateArrayAndDoNextSwap(amount_to_be_swapped, swapInputs, array_coins, tokenToBeSwappedContract)
    })
  }
}

async function getBalance(token_address) {
  // create a new instance of a contract - in web3.js >1.0.0, will have to use "new web3.eth.Contract" (uppercase C)
  var tokenContract = new ethers.Contract(token_address, token_abi, signer)
  // get the balance of our user in that token
  try {
    var tokenBalance = await tokenContract.balanceOf(BENTOBOX_BALANCER_DAPP_ADDRESS);
    return tokenBalance;
  } catch (error) {
    console.log(error)
  }
}

async function getTokenBalanceInfo(accountOrContract) {
  
  function Coin(symbol, address, oracleAddress, decimals, balance, usd_balance, diff_from_average, usd_exchange_rate) { //in JS we create an object type by using a constructor function
    this.symbol = symbol;
    this.address = address;
    this.oracleAddress = oracleAddress;
    this.decimals = decimals;
    this.balance = balance;
    this.usd_balance = usd_balance;
    this.diff_from_average = diff_from_average;
    this.usd_exchange_rate = usd_exchange_rate;
  }

  //create a coin object for each of our 4 assets
  var WMATIC = new Coin("WMATIC", WMATIC_ADDRESS, MATIC_USD_ORACLE); 
  var SUSHI = new Coin("SUSHI", SUSHI_ADDRESS, SUSHI_USD_ORACLE); 
  var WBTC = new Coin("WBTC", WBTC_ADDRESS, BTC_USD_ORACLE); 
  var WETH = new Coin("WETH", WETH_ADDRESS, ETH_USD_ORACLE);

  var array_coins = [WMATIC, SUSHI, WBTC, WETH];
  var total_in_usd = 0;

  for (let coin of array_coins) {
    coin.balance = await getBentoBoxBalance(coin.address, accountOrContract);
    coin.usd_exchange_rate = await getExchangeRate(coin.oracleAddress);
    coin.decimals = await getDecimals(coin.address);
    coin.usd_balance = parseFloat(ethers.utils.formatUnits(coin.balance, coin.decimals)) * coin.usd_exchange_rate;
    total_in_usd += coin.usd_balance;
  }

  var no_of_assets = array_coins.length;
  var target_per_asset = total_in_usd / no_of_assets;
  for (let coin of array_coins) {
    coin.diff_from_average = coin.usd_balance - target_per_asset;
  }

  return array_coins;
}

async function getBentoBoxBalance(token_address, accountOrContract) {
  // create a new instance of a contract - in web3.js >1.0.0, will have to use "new web3.eth.Contract" (uppercase C)
  try {
    var dappContract = new ethers.Contract(BENTOBOX_BALANCER_DAPP_ADDRESS, bento_dapp_abi, provider);
    var token_balance = await dappContract.BentoTokenBalanceOf(token_address, accountOrContract);
    return token_balance;
  } catch (error) {
    console.log(error)
  }
}

async function getExchangeRate(oracle_address) {
  var oracle = new ethers.Contract(oracle_address, CHAINLINK_ORACLE_ABI, provider);
  try {
    var exchangeRate = await oracle.latestAnswer();
    exchangeRate = exchangeRate.toNumber() //converts from BigNumber
    exchangeRate = exchangeRate / (10 ** 8);
    return exchangeRate;
  } catch (error) {
    console.log(error);
  }
}

async function getDecimals(token_address) {
  var tokenContract = new ethers.Contract(token_address, token_abi, provider)
  // check how many decimals that token has
  try {
    var decimals = await tokenContract.decimals();//need to catch an error here - perhaps make this it's own function!
    return decimals;
  } catch (error) {
    console.log(error);
  }
}

async function displayBalances() {  
  getWMATICResult.innerHTML = parseFloat(ethers.utils.formatUnits(await getBentoBoxBalance(WMATIC_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS), 18)).toFixed(6) || 'Not able to get accounts';

  getSUSHIResult.innerHTML = parseFloat(ethers.utils.formatUnits(await getBentoBoxBalance(SUSHI_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS), 18)).toFixed(6) || 'Not able to get accounts';

  getWBTCResult.innerHTML = parseFloat(ethers.utils.formatUnits(await getBentoBoxBalance(WBTC_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS), 8)).toFixed(6) || 'Not able to get accounts';

  getWETHResult.innerHTML = parseFloat(ethers.utils.formatUnits(await getBentoBoxBalance(WETH_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS), 18)).toFixed(6) || 'Not able to get accounts';
}

async function displayUSDBalances() {
  var wmatic_usd = await getExchangeRate(MATIC_USD_ORACLE)*parseFloat(ethers.utils.formatUnits(await getBentoBoxBalance(WMATIC_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS), 18));
  WMATICInUsd.innerHTML = wmatic_usd.toFixed(2) || 'Not able to get accounts';
  var sushi_usd = await getExchangeRate(SUSHI_USD_ORACLE)*parseFloat(ethers.utils.formatUnits(await getBentoBoxBalance(SUSHI_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS), 18));
  SUSHIInUsd.innerHTML = sushi_usd.toFixed(2) || 'Not able to get accounts';
  var wbtc_usd = await getExchangeRate(BTC_USD_ORACLE)*parseFloat(ethers.utils.formatUnits(await getBentoBoxBalance(WBTC_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS), 8));
  WBTCInUsd.innerHTML = wbtc_usd.toFixed(2) || 'Not able to get accounts';
  var weth_usd = await getExchangeRate(ETH_USD_ORACLE)*parseFloat(ethers.utils.formatUnits(await getBentoBoxBalance(WETH_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS), 18));
  WETHInUsd.innerHTML = weth_usd.toFixed(2) || 'Not able to get accounts';

  TotalInUSD.innerHTML = wmatic_usd + sushi_usd + wbtc_usd + weth_usd;
}

async function withdrawBalanceFromBentoBoxToDapp(token_address) { //need to change this to withdraw all available balance?
  try {
    var dappContract = new ethers.Contract(BENTOBOX_BALANCER_DAPP_ADDRESS, bento_dapp_abi, signer);
    var token_balance = await dappContract.BentoTokenBalanceOf(token_address, user);
    await dappContract.withdraw(token_balance, token_address, user, BENTOBOX_BALANCER_DAPP_ADDRESS);
  } catch (error) {
    console.log(error);
  }
}

async function withdrawNewDepositFromBentoBoxToDapp(depositAmount) { //need to change this to withdraw all available balance?
  try {
    // var provider = ethers.providers.getDefaultProvider('ropsten');
    // provider: () => new HDWalletProvider(mnemonic, `https://polygon-mainnet.infura.io/v3/1a34a37dbf4e44409187911e6573a844`)
    // const HDWalletProvider = require('@truffle/hdwallet-provider');
    
    // provider = new ethers.hdNode.fromMnemonic(mnemonic);
    // // provider = new ethers.providers.InfuraProvider("polygon", "1a34a37dbf4e44409187911e6573a844");
    // // const fs = require('fs');
    // // const mnemonic = fs.readFileSync(".secret").toString().trim();
    // var walletMnemonic = new ethers.Wallet.fromMnemonic(mnemonic)

    // var wallet = new ethers.Wallet(privateKey, provider);
    var dappContract = new ethers.Contract(BENTOBOX_BALANCER_DAPP_ADDRESS, bento_dapp_abi, signer);
    await dappContract.withdraw(depositAmount, USDC_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS);
  } catch (error) {
    console.log(error);
  }
}


async function swapUSDCintoFourTokensAndDepositBackToBB(_depositAmountUSDC) {
  //CALCULATE THE PROPORTIONS OF WHAT"S CURRENTLY IN THE DAPP ON BB
  var array_coins = await getTokenBalanceInfo(BENTOBOX_BALANCER_DAPP_ADDRESS);
  console.log("got token info")
  var USD_total = array_coins[0].usd_balance + array_coins[1].usd_balance + array_coins[2].usd_balance + array_coins[3].usd_balance
  if (USD_total == 0) { //in case there's nothing in the Bentobox yet...
    var depositAmountUSDC = 1;
    var WMATIC_share = 0.25 * depositAmountUSDC * 10 ** 6;
    var SUSHI_share = 0.25 * depositAmountUSDC * 10 ** 6;
    var WBTC_share = 0.25 * depositAmountUSDC * 10 ** 6;
    var WETH_share = 0.25 * depositAmountUSDC * 10 ** 6;
  } else {
    var WMATIC_share = array_coins[0].usd_balance / USD_total * depositAmountUSDC * 10 ** 6;
    var SUSHI_share = array_coins[1].usd_balance / USD_total * depositAmountUSDC * 10 ** 6;
    var WBTC_share = array_coins[2].usd_balance / USD_total * depositAmountUSDC * 10 ** 6;
    var WETH_share = array_coins[3].usd_balance / USD_total * depositAmountUSDC * 10 ** 6;
  }
  // console.log(array_coins[0].usd_balance)
  // console.log(USD_total)
  // console.log(depositAmountUSDC)
  // console.log(array_coins)

  //SWAP USDC INTO THE FOUR CRYPTOS
  //LISTEN FOR THE SWAPs TO ALL BE COMPLETED
  var _tokenToBeSwappedContract = new ethers.Contract(USDC_ADDRESS, token_abi, provider)
  var tokenTransferredFilter = _tokenToBeSwappedContract.filters.Transfer(BENTOBOX_BALANCER_DAPP_ADDRESS, null);
  // console.log(WMATIC_share);
  // console.log(array_coins[0].usd_exchange_rate);
  // console.log(WMATIC_share / array_coins[0].usd_exchange_rate * 0.75);

  if(checkIfApprovedForAmount(USDC_ADDRESS, depositAmountUSDC * 10 ** 6)) {
    giveApprovalFromDapp(USDC_ADDRESS, SUSHISWAP_ROUTER, depositAmountUSDC * 10 ** 6);
  }
  //here need to listen for approval event... (these swaps can all be done at once...)
  var WMATIC_amount_out = await executeDappSwap(WMATIC_share, parseInt(WMATIC_share / array_coins[0].usd_exchange_rate * 0.75), [USDC_ADDRESS, WMATIC_ADDRESS], BENTOBOX_BALANCER_DAPP_ADDRESS, Date.now() + 1111111111111);
  _tokenToBeSwappedContract.once(tokenTransferredFilter, async (from, to, amount, event) => {
    console.log(`${from} sent ${amount} to ${to}`);
    var SUSHI_amount_out = await executeDappSwap(SUSHI_share, parseInt(SUSHI_share / array_coins[1].usd_exchange_rate * 0.75), [USDC_ADDRESS, SUSHI_ADDRESS], BENTOBOX_BALANCER_DAPP_ADDRESS, Date.now() + 1111111111111);
    _tokenToBeSwappedContract.once(tokenTransferredFilter, async (from, to, amount, event) => {
      console.log(`${from} sent ${amount} to ${to}`);
      var WBTC_amount_out = await executeDappSwap(WBTC_share, parseInt(WBTC_share / array_coins[2].usd_exchange_rate * 0.75), [USDC_ADDRESS, WBTC_ADDRESS], BENTOBOX_BALANCER_DAPP_ADDRESS, Date.now() + 1111111111111);
      _tokenToBeSwappedContract.once(tokenTransferredFilter, async (from, to, amount, event) => {
        console.log(`${from} sent ${amount} to ${to}`);
        var WETH_amount_out = await executeDappSwap(WETH_share, parseInt(WETH_share / array_coins[3].usd_exchange_rate * 0.75), [USDC_ADDRESS, WETH_ADDRESS], BENTOBOX_BALANCER_DAPP_ADDRESS, Date.now() + 1111111111111);
        _tokenToBeSwappedContract.once(tokenTransferredFilter, async (from, to, amount, event) => {
          console.log(`${from} sent ${amount} to ${to}`);
          // THEN DEPOSIT THOSE FOUR CRYPTOS BACK INTO THE DAPP - ALL DONE
          dappContract.depositToBento(WMATIC_amount_out, WMATIC_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS);
          dappContract.depositToBento(SUSHI_amount_out, SUSHI_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS);
          dappContract.depositToBento(WBTC_amount_out, WBTC_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS);
          dappContract.depositToBento(WETH_amount_out, WETH_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS, BENTOBOX_BALANCER_DAPP_ADDRESS);
        })
      })
    })
  })
}


function sortCoinsDescendingByDiffFromAvg(_array_coins) {
  _array_coins.sort((a, b) => {
    return b.diff_from_average - a.diff_from_average;
  });
}

async function checkIfApprovedForAmount(_token_address, _amount) {
  var approvedAmount = await getAllowance(_token_address, SUSHISWAP_ROUTER) //input token and router addresses
  console.log(approvedAmount); //293
  console.log(_amount); //9907
  if (approvedAmount.lt(_amount)) return false;
  else return true;
}

async function getAllowance(token_address, router_address) {
  // create a new instance of a contract
  var tokenContract = new ethers.Contract(token_address, token_abi, signer)
  // check what amount of user's tokens the spender is approved to use
  try {
    var approvedAmount = await tokenContract.allowance(BENTOBOX_BALANCER_DAPP_ADDRESS, router_address); //allowance(owner_address, spender_address)
    return approvedAmount;
  } catch (error) {
    console.log(error)
  }
}

async function giveApprovalFromUser(token_address, router_address, amountIn) {
    // create a new instance of a contract
    var tokenContract = new ethers.Contract(token_address, token_abi, signer)
    // give router_address approval to spend user's tokens
    try {
      var approved = await tokenContract.approve(router_address, amountIn); //approve(spender, amount)
      return approved;
  
    } catch (error) {
      console.log(error)
    }
}

async function giveApprovalFromDapp(token_address, router_address, amountIn) {
  // create a new instance of a contract
  var dappContract = new ethers.Contract(BENTOBOX_BALANCER_DAPP_ADDRESS, bento_dapp_abi, signer);

  // give router_address approval to spend dapp's tokens
  try {
    var approved = await dappContract.approve_spending(token_address, router_address, amountIn); //approve(spender, amount)
    return approved;

  } catch (error) {
    console.log(error)
  }
}
// async function approvalConfirmed() {
//   var approvalconfirmed = await tokenContract.once("Approval", (owner, spender, value, event) => {
//     console.log('Tokens approved');
//   }

function getSwapInputs(array_coins) {
  if (array_coins[0].diff_from_average > Math.abs(array_coins[array_coins.length - 1].diff_from_average)) { //check which coin is further from the dollar average

    var swap_path = [array_coins[0].address, array_coins[array_coins.length - 1].address] //swap from first array item to last

    var amountIn = Math.abs(array_coins[array_coins.length - 1].diff_from_average) * (1 / (array_coins[0].usd_exchange_rate)) //figure out how much to swap
    var amountOutMin = Math.abs(array_coins[array_coins.length - 1].diff_from_average) * (1 / (array_coins[array_coins.length - 1].usd_exchange_rate)) * 0.75;

    var amountIn_Wei = parseInt(amountIn * 10 ** array_coins[0].decimals).toString() //am I introducing potential rounding errors here? And should I check for NaN after?
    var amountOutMin_Wei = parseInt(amountOutMin * 10 ** array_coins[array_coins.length - 1].decimals).toString()

    console.log(`Swapping ${amountIn.toFixed(8)} of ${array_coins[0].symbol} for ${array_coins[array_coins.length - 1].symbol}`);
    $("#swapStarted").css("display", "block");
    $("#swapStarted").text(`Swapping ${amountIn.toFixed(8)} of ${array_coins[0].symbol} for ${array_coins[array_coins.length - 1].symbol}`);

    return [amountIn_Wei, amountOutMin_Wei, swap_path];
  }
  else {

    var swap_path = [array_coins[0].address, array_coins[array_coins.length - 1].address]; // swap from last array item to first

    var amountIn = Math.abs(array_coins[0].diff_from_average) * (1 / (array_coins[0].usd_exchange_rate)); //figure out how much to swap
    var amountOutMin = Math.abs(array_coins[0].diff_from_average) * (1 / (array_coins[array_coins.length - 1].usd_exchange_rate)) * 0.75;
    console.log(array_coins[array_coins.length - 1].usd_exchange_rate);
    var amountIn_Wei = parseInt(amountIn * 10 ** array_coins[0].decimals).toString() //am I introducing potential rounding errors here? And should I check for NaN after?
    var amountOutMin_Wei = parseInt(amountOutMin * 10 ** array_coins[array_coins.length - 1].decimals).toString()
    console.log(amountOutMin_Wei);

    console.log(`Swapping ${amountIn.toFixed(8)} of ${array_coins[0].symbol} for ${array_coins[array_coins.length - 1].symbol}`);
    $("#swapStarted").css("display", "block");
    $("#swapStarted").text(`Swapping ${amountIn.toFixed(8)} of ${array_coins[0].symbol} for ${array_coins[array_coins.length - 1].symbol}`);

    return [amountIn_Wei, amountOutMin_Wei, swap_path];
  }
}

async function askUserForApproval(_token_address, _amount) {
  if (window.confirm("Time to get approval!")) {
    //ask for approval
    await giveApprovalFromDapp(_token_address, SUSHISWAP_ROUTER, _amount); //token_address, router_address, amountIn
  }
}

async function confirmAndExecuteSwapAndUpdateArrayAndDoNextSwap(_amount_to_be_swapped, _swapInputs, _array_coins, _tokenToBeSwappedContract) {

  if (window.confirm("Confirm Swap")) {
    await executeDappSwap(_amount_to_be_swapped, _swapInputs[1], _swapInputs[2], BENTOBOX_BALANCER_DAPP_ADDRESS, Date.now() + 1111111111111);

    updateArray(_array_coins);
    if (_array_coins.length > 1) {
      executeNextSwapOnceLastOneConfirms(_tokenToBeSwappedContract, _array_coins);
    }
  }
}

async function executeSwap(_amountIn, _amountOutMin, _path, _acct, _deadline) {
  var router = new ethers.Contract(SUSHISWAP_ROUTER, ROUTER_ABI, signer)
  try {
    var swap = await router.swapExactTokensForTokens(_amountIn,
      _amountOutMin,
      _path,
      _acct,
      _deadline)
  }
  catch (error) {
    console.log(error); //can I get it to try again here??
  }
}

async function executeDappSwap(_amountIn, _amountOutMin, _path, _acct, _deadline) {
  try {
    var dappContract = new ethers.Contract(BENTOBOX_BALANCER_DAPP_ADDRESS, bento_dapp_abi, signer);
    return dappContract.swap (_amountIn, _amountOutMin, _path, _acct, _deadline);
  }
  catch (error) {
    console.log(error); //can I get it to try again here??
  }
}

async function executeNextSwapOnceLastOneConfirms(_tokenToBeSwappedContract, _array_coins) {
  var tokenTransferredFilter = _tokenToBeSwappedContract.filters.Transfer(BENTOBOX_BALANCER_DAPP_ADDRESS, null);
  _tokenToBeSwappedContract.once(tokenTransferredFilter, async (from, to, amount, event) => {
    console.log(`${from} sent ${amount} to ${to}`);
    await balanceAndRemoveOneCoin(_array_coins);
  })
}

function updateArray(array_coins) {
  if (array_coins[0].diff_from_average > Math.abs(array_coins[array_coins.length - 1].diff_from_average)) { //check which coin is further from the dollar average
    decreaseFirstCoinDiffFromAverage(array_coins);
    removeFirstCoinAndReSort(array_coins);
  }
  else {
    decreaseLastCoinDiffFromAverage(array_coins)
    removeLastCoinAndReSort(array_coins);
  }
}

function decreaseFirstCoinDiffFromAverage(_array_coins) {
  _array_coins[0].diff_from_average -= Math.abs(_array_coins[_array_coins.length - 1].diff_from_average);
}

function decreaseLastCoinDiffFromAverage(_array_coins) {
  _array_coins[_array_coins.length - 1].diff_from_average += Math.abs(_array_coins[0].diff_from_average);
}

function removeFirstCoinAndReSort(_array_coins) {
  _array_coins.pop() //removes the last element from the array

  sortCoinsDescendingByDiffFromAvg(_array_coins);
}

function removeLastCoinAndReSort(_array_coins) {
  _array_coins.shift(); //remove the first element from the array

  sortCoinsDescendingByDiffFromAvg(_array_coins);
}