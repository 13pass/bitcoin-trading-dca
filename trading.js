'use strict';

require('dotenv').config();

const ccxt = require('ccxt');
const moment = require('moment');
const util = require('util');
const bitstamp = new ccxt.bitstamp({
  'apiKey': process.env.BITSTAMP_KEY,
  'secret': process.env.BITSTAMP_SECRET,
  'uid': process.env.BITSTAMP_UID,
  getLastTransactions: async function () {
    let request = this.extend ({}, {});
    return await this.privatePostUserTransactions (request);
  },
  nonce: function () {
    let nonce = this.milliseconds ().toString ();
    if (nonce !== this.last) {
      this.nonceIncr = -1;
    }
    this.last = nonce;
    this.nonceIncr ++;
    let nonceSuffix = ('000'+this.nonceIncr).slice (-4);
    return nonce + nonceSuffix;
  }
}); 

const timestamp = () => new Date().toISOString();

//console.log (bitstamp.id, await bitstamp.loadMarkets ());

const investmentAmount = process.env.INVESTMENT_AMOUNT || 6;
console.log('investmentAmount', investmentAmount);
const cryptoCurrency = (process.env.CRYPTOCURRENCY || 'BTC').toUpperCase();;
const fiatCurrency = (process.env.FIATCURRENCY || 'EUR').toUpperCase();
let walletAddress = '174Sq6CzcWwouFB9MZtbPn6dKjysN7nsHG';
if (cryptoCurrency ==='BTC'){
  walletAddress = process.env.BTC_WALLET_ADDRESS;
}
const pair = `${cryptoCurrency}/${fiatCurrency}`;
console.log('pair', pair);
console.log(cryptoCurrency,fiatCurrency);

const treatLastTransactionDate = async (transactionDate) => {
  let result = { 
    hasTransactionToday : true,
    firstDayOfMonth : false
  };
  let now = moment().format('YYYYMMDD');
  if (now.substring(6) === '01'){
    result.firstDayOfMonth = true ;
  }
  if (transactionDate) {
    let lastTransactionDay = moment(transactionDate).format('YYYYMMDD');
    //console.log('moments', now, lastTransactionDay, transactionDate);
    if (now !== lastTransactionDay){
      result.hasTransactionToday = false;
    }
  }
  return result;
}

const main = async () => {
  try {
    // Retrieve crypto/eur price
    //const tickResponse = await bitstamp.fetch_ticker(pair);
    console.log('b4 orderBook');
    const orderBook = await bitstamp.fetchOrderBook(pair);
    let diffPercent = (orderBook.asks[0][0]-orderBook.bids[0][0])/orderBook.asks[0][0]* 100;
    //console.log('order book',orderBook.asks[0],orderBook.bids[0], diffPercent);

    const cryptoPrice = orderBook.asks[0][0];
    const volumeToBuy = (investmentAmount/cryptoPrice).toFixed(6);
    console.log('volume available:',orderBook.asks[0][1],'to buy:',volumeToBuy);
    const roundedInvestmentAmount = (volumeToBuy*cryptoPrice).toFixed(3);
    console.log('roundedInvestmentAmount', roundedInvestmentAmount);
    if ( (diffPercent>0.6) || (volumeToBuy > orderBook.asks[0][1]) ) {
      console.log("conditions not met");
      return;
    }
    let msg = `[${timestamp()}] Buying ${volumeToBuy} ${cryptoCurrency}`;
    msg+= `which is equal to ${roundedInvestmentAmount} ${fiatCurrency}`;
    msg+= `at price ${cryptoPrice} ${fiatCurrency}/${cryptoCurrency}\n`;
    const logMessage = util.format(msg);

    let trades = await bitstamp.getLastTransactions();
    let alreadyBoughtToday = false;
        
   //let withdrawResponse = await bitstamp.privatePostEthWithdrawal(cryptoCurrency,0.000516,walletAddress);
    //console.log('time to withdraw cryptos',withdrawResponse);
    
    if (trades){
      let resultDates = await treatLastTransactionDate(trades[0].datetime);  
      alreadyBoughtToday = resultDates.hasTransactionToday;
      if (resultDates.firstDayOfMonth){
        let balance = await bitstamp.privatePostBalance();
        console.log('balance',balance);
        if (balance.btc_available > 0){
          let params = {
            amount:balance.btc_available,
            address:walletAddress
          };
          let withdrawResponse = await bitstamp.v1PostBitcoinWithdrawal(params);
          console.log('time to withdraw cryptos',withdrawResponse);
        }   
      }
    }
    if (!alreadyBoughtToday) {
      console.log('buy disposed amount for today');
      let tradeResponse = await bitstamp.createMarketBuyOrder(pair, volumeToBuy);
      console.log('tradeResponse',tradeResponse);
      // Retrieve and log transaction ids
      const txIds = tradeResponse['info']['id'];
      if (typeof txIds === 'undefined') {
        console.error('Unable to read transaction ids');
        return;
      }
      console.log(`[${timestamp()}] Trade completed successfully: ${txIds}`,txIds);
    }else{
      console.log('cryptocurrencies bought already');
    }
  } catch (e) {
    console.error(`[${timestamp()}] Unable to perform operation: ${e}`);
  }
};

main();
