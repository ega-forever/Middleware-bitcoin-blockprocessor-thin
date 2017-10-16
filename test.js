const Promise = require('bluebird'),
  _ = require('lodash'),
  bitcoin = Promise.promisifyAll(require('bitcoin'));

let client = new bitcoin.Client({
  host: 'localhost',
  port: 18332,
  user: 'user',
  pass: '123',
  timeout: 30000
});

let init = async () => {

  let blockHash = await client.getBlockHashAsync(4110).catch(() => Promise.reject({code: 0}));
  let block = await client.getBlockAsync(blockHash);
  //let rawTxs = await Promise.mapSeries(block.tx, tx => client.getRawTransactionAsync(tx, 1));
  //let rawTxs = await Promise.mapSeries(block.tx, tx => client.getRawTransactionAsync(tx, 1));

  let batch = block.tx.map(tx => ({
    method: 'getrawtransaction',
    params: [tx, 1]
  }));

  let rawTxs = await new Promise(res => {
    let counter = 0;
    let result = [];
    client.cmd(batch, function (err, data) {
      counter++;
      if (err) return console.log(err);
      result.push(data);
      if (counter === batch.length)
        res(result);
    });
  });

  console.log(rawTxs.length);




  for (let s = 0; s < rawTxs.length; s++) {
    console.log(s)
    let batch = _.chain(rawTxs[s].vin)
      .filter(v => v.txid)
      .map(v=>({
        method: 'getrawtransaction',
        params: [v.txid, 1]
      }))
      .value();


    rawTxs[s].vin = await new Promise(res => {
      let counter = 0;
      let result = [];





      client.cmd(batch, function (err, data) {
        counter++;
        if (err) return console.log(err);
        result.push(data);
        if (counter === batch.length)
          res(result);
      });
    });



  }

  let addresses = _.chain(rawTxs)
    .map(tx => _.union(tx.vin, tx.vout))
    .flattenDeep()
    .map(v => v.scriptPubKey.addresses)
    .flattenDeep()
    .uniq()
    .value();

  let filtered = [_.take(addresses, 2), []];

  let out = _.chain(filtered)
    .flattenDeep()
    .compact()
    .map(account => ({
      address: account,
      txs: _.chain(rawTxs)
        .filter(tx => _.chain(tx.vin)
          .union(tx.vout)
          .flattenDeep()
          .map(v => v.scriptPubKey.addresses)
          .flattenDeep()
          .includes(account)
          .value()
        )
        .map(tx => tx.hash)
        .value()
    }))
    .value();

  console.log(out)

};

module.exports = init().catch(e => console.log(e));
