import './App.css'
import { useState } from 'react'
import {
  cTokenAbiJson,
  erc20AbiJson,
  abiJson,
  underlyingContractAddress,
  cETHcontractAddress,
} from './config'

function App() {
  const [account, setAccount] = useState()
  const [valueSupply, setValueSupply] = useState('')
  const [valueReedem, setValueReedem] = useState('')
  const [apy, setApy] = useState('')
  const [amountETH, setAmountEth] = useState('')
  const [amountRedeemETH, setAmountRedeemETH] = useState('')

  const load = async () => {
    const web3 = new Web3(Web3.givenProvider || 'http://localhost:7545')
    const accounts = await web3.eth.requestAccounts()
    setAccount(accounts[0])
  }
  const Web3 = require('web3')
  const web3 = new Web3(window.ethereum)
  const myWalletAddress = '0x154C4c76BE2FB3D58A069e9e191F1C1b947acd3a'

  const fromMyWallet = {
    from: myWalletAddress,
    gasLimit: web3.utils.toHex(500000),
    // gasPrice: web3.utils.toHex(20000000000), // use ethgasstation.info (mainnet only)
  }

  const cTokenContractAddress = '0xF0d0EB522cfa50B716B3b1604C4F0fA6f04376AD'
  const cTokenContract = new web3.eth.Contract(cTokenAbiJson, cTokenContractAddress)

  const underlyingContract = new web3.eth.Contract(erc20AbiJson, underlyingContractAddress)
  const cEthContract = new web3.eth.Contract(abiJson, cETHcontractAddress)
  const ethDecimals = 18

  const assetName = 'DAI'
  const underlyingDecimals = 18

  const calculateApy = async (contract) => {
    let supplyRatePerBlock = await contract.methods.supplyRatePerBlock().call()

    const mantissa = Math.pow(10, 18)
    const blocksPerDay = 4 * 60 * 24
    const daysPerYear = 365

    const supplyApy =
      (Math.pow((+supplyRatePerBlock.toString() / mantissa) * blocksPerDay + 1, daysPerYear) - 1) *
      100

    console.log(`Current APY for ${assetName} is:`, supplyApy, '\n')
  }

  const supplyErc20 = async function () {
    let tokenBalance = (await underlyingContract.methods.balanceOf(myWalletAddress).call()) / 1e18
    console.log(`My wallet's ${assetName} Token Balance:`, tokenBalance)

    const underlyingTokensToSupply = Number(valueSupply) * Math.pow(10, underlyingDecimals)

    await underlyingContract.methods
      .approve(cTokenContractAddress, web3.utils.toBN(underlyingTokensToSupply))
      .send(fromMyWallet)

    console.log(`${assetName} contract "Approve" operation successful.`)
    console.log(`Supplying ${assetName} to the Compound Protocol...`, '\n')

    await cTokenContract.methods
      .mint(web3.utils.toBN(underlyingTokensToSupply.toString()))
      .send(fromMyWallet)

    console.log(`c${assetName} "Mint" operation successful.`, '\n')

    const balanceOfUnderlying =
      web3.utils.toBN(await cTokenContract.methods.balanceOfUnderlying(myWalletAddress).call()) /
      Math.pow(10, underlyingDecimals)

    console.log(`${assetName} supplied to the Compound Protocol:`, balanceOfUnderlying, '\n')

    let cTokenBalance = (await cTokenContract.methods.balanceOf(myWalletAddress).call()) / 1e8
    console.log(`My wallet's c${assetName} Token Balance:`, cTokenBalance)

    let underlyingBalance = await underlyingContract.methods.balanceOf(myWalletAddress).call()
    underlyingBalance = underlyingBalance / Math.pow(10, underlyingDecimals)
    console.log(`My wallet's ${assetName} Token Balance:`, underlyingBalance, '\n')

    let erCurrent = await cTokenContract.methods.exchangeRateCurrent().call()
    let exchangeRate = erCurrent / Math.pow(10, 18 + underlyingDecimals - 8)
    console.log(`Current exchange rate from c${assetName} to ${assetName}:`, exchangeRate, '\n')
    calculateApy(cTokenContract)
  }

  const reedemErc20 = async () => {
    let underlyingBalance = await underlyingContract.methods.balanceOf(myWalletAddress).call()
    underlyingBalance = underlyingBalance / Math.pow(10, underlyingDecimals)
    console.log(`Redeeming the c${assetName} for ${assetName}...`)

    console.log(`Exchanging all c${assetName} based on cToken amount...`, '\n')
    await cTokenContract.methods.redeem(Number(valueReedem) * 1e8).send(fromMyWallet)

    let cTokenBalance = await cTokenContract.methods.balanceOf(myWalletAddress).call()
    cTokenBalance = cTokenBalance / 1e8
    console.log(`My wallet's c${assetName} Token Balance:`, cTokenBalance)

    underlyingBalance = await underlyingContract.methods.balanceOf(myWalletAddress).call()
    underlyingBalance = underlyingBalance / Math.pow(10, underlyingDecimals)
    console.log(`My wallet's ${assetName} Token Balance:`, underlyingBalance, '\n')
    calculateApy(cTokenContract)
  }

  const supplyETH = async () => {
    let ethBalance = (await web3.eth.getBalance(myWalletAddress)) / Math.pow(10, ethDecimals)
    console.log("My wallet's ETH balance:", ethBalance, '\n')

    console.log('Supplying ETH to the Compound Protocol...', '\n')
    // Mint some cETH by supplying ETH to the Compound Protocol
    await cEthContract.methods.mint().send({
      from: myWalletAddress,
      gasLimit: web3.utils.toHex(250000),
      gasPrice: web3.utils.toHex(20000000000), // use ethgasstation.info (mainnet only)
      value: web3.utils.toHex(web3.utils.toWei(amountETH, 'ether')),
    })

    console.log('cETH "Mint" operation successful.', '\n')

    const balanceOfUnderlying =
      web3.utils.toBN(await cEthContract.methods.balanceOfUnderlying(myWalletAddress).call()) /
      Math.pow(10, ethDecimals)

    console.log('ETH supplied to the Compound Protocol:', balanceOfUnderlying, '\n')

    let cTokenBalance = (await cEthContract.methods.balanceOf(myWalletAddress).call()) / 1e8

    console.log("My wallet's cETH Token Balance:", cTokenBalance, '\n')
    calculateApy(cEthContract)
    let exchangeRateCurrent = await cEthContract.methods.exchangeRateCurrent().call()
    exchangeRateCurrent = exchangeRateCurrent / Math.pow(10, 18 + ethDecimals - 8)
    console.log('Current exchange rate from cETH to ETH:', exchangeRateCurrent, '\n')
  }

  const reedemETH = async () => {
    console.log('Redeeming the cETH for ETH...', '\n')

    console.log('Exchanging all cETH based on cToken amount...', '\n')
    await cEthContract.methods.redeem(amountRedeemETH * 1e8).send({
      from: myWalletAddress,
      gasLimit: web3.utils.toHex(500000),
      // gasPrice: web3.utils.toHex(20000000000), // use ethgasstation.info (mainnet only)
    })

    // console.log('Exchanging all cETH based on underlying ETH amount...', '\n');
    // let ethAmount = web3.utils.toWei(balanceOfUnderlying).toString()
    // await cEthContract.methods.redeemUnderlying(ethAmount).send({
    //   from: myWalletAddress,
    //   gasLimit: web3.utils.toHex(150000),
    //   gasPrice: web3.utils.toHex(20000000000), // use ethgasstation.info (mainnet only)
    // });
    calculateApy(cEthContract)
    let exchangeRateCurrent = await cEthContract.methods.exchangeRateCurrent().call()
    exchangeRateCurrent = exchangeRateCurrent / Math.pow(10, 18 + ethDecimals - 8)
    console.log('Current exchange rate from cETH to ETH:', exchangeRateCurrent, '\n')

    let ethBalance = (await web3.eth.getBalance(myWalletAddress)) / Math.pow(10, ethDecimals)
    let cTokenBalance = (await cEthContract.methods.balanceOf(myWalletAddress).call()) / 1e8
    console.log("My wallet's cETH Token Balance:", cTokenBalance)

    ethBalance = (await web3.eth.getBalance(myWalletAddress)) / Math.pow(10, ethDecimals)
    console.log("My wallet's ETH balance:", ethBalance, '\n')
  }
  return (
    <div className='App'>
      <h1>LoansTGT App</h1>
      <h2>{account}</h2>

      <button className='enable-button' id='enable-button' onClick={load}>
        Connect
      </button>
      <div className='asset-interface'>
        <div class='row1'>
          <h3>DAI</h3>
        </div>
        <div className='row2'>
          <label>
            Compound Protocol DAI APY: <span id='eth-apy'>{apy}</span>%
          </label>
        </div>
        <div className='row3'>
          <input
            id='eth-supply'
            type='text'
            placeholder='DAI'
            value={valueSupply}
            onChange={(e) => setValueSupply(e.target.value)}
          />
          <button id='eth-supply-button' onClick={supplyErc20}>
            Supply
          </button>
        </div>
        <div className='row4'>
          <input
            id='eth-redeem'
            type='text'
            placeholder='cDAI'
            value={valueReedem}
            onChange={(e) => setValueReedem(e.target.value)}
          />
          <button id='eth-redeem-button' onClick={reedemErc20}>
            Redeem
          </button>
        </div>
      </div>
      <div className='asset-interface'>
        <div class='row1'>
          <h3>ETH</h3>
        </div>
        <div className='row2'>
          <label>
            Compound Protocol ETH APY: <span id='eth-apy'>{apy}</span>%
          </label>
        </div>
        <div className='row3'>
          <input
            id='eth-supply'
            type='text'
            placeholder='ETH'
            value={amountETH}
            onChange={(e) => setAmountEth(e.target.value)}
          />
          <button id='eth-supply-button' onClick={supplyETH}>
            Supply
          </button>
        </div>
        <div className='row4'>
          <input
            id='eth-redeem'
            type='text'
            placeholder='cETH'
            value={amountRedeemETH}
            onChange={(e) => setAmountRedeemETH(e.target.value)}
          />
          <button id='eth-redeem-button' onClick={reedemETH}>
            Redeem
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
