/* eslint-disable no-await-in-loop */
/* eslint-disable class-methods-use-this */
const shim = require('fabric-shim');
// const uuidv1 = require('uuid/v1');

const ACCOUNT_PREFIX = 'a_';
const TRANSACTION_PREFIX = 't_';
const DEPOSIT_TYPE = 'DEPOSIT';
const WITHDRAWAL_TYPE = 'WITHDRAWAL';

async function createTransaction(stub, {
  accountId, amount, type, date,
}) { // appends a timestamp plus a 0 - 99 random number for the transaction key
  return stub.putState(`${TRANSACTION_PREFIX}${accountId}_${Date.now()}${Math.random() * 100}`, Buffer.from(JSON.stringify({
    type, date, amount,
  })));
}

async function parseResults(iterator) {
  const results = {};
  while (true) {
    const res = await iterator.next();
    if (res.value && res.value.value.toString()) {
      try {
        results[res.value.key] = JSON.parse(res.value.value.toString('utf8'));
      } catch (err) {
        results[res.value.key] = res.value.value.toString('utf8');
      }
    }
    if (res.done) {
      await iterator.close();
      return Buffer.from(JSON.stringify(results));
    }
  }
}

const Account = class {
  /**
   * Initialize the state when the chaincode is either instantiated or upgraded
   *
   * @param {*} stub
   */
  async Init(stub) {
    // console.log('=========== Init: Instantiated / Upgraded ngo chaincode ===========');
    return shim.success();
  }

  /**
   * The Invoke method will call the methods below based on the method name passed by the calling
   * program.
   *
   * @param {*} stub
   */
  async Invoke(stub) {
    // console.log('============= START : Invoke ===========');
    const ret = stub.getFunctionAndParameters();
    // console.log(`##### Invoke args: ${JSON.stringify(ret)}`);

    const method = this[ret.fcn];
    if (!method) {
      // console.error(`##### Invoke - error: no chaincode function with name: ${ret.fcn} found`);
      throw new Error(`No chaincode function with name: ${ret.fcn} found`);
    }
    try {
      const response = await method(stub, ret.params);
      // console.log(`##### Invoke response payload: ${response}`);
      return shim.success(response);
    } catch (err) {
      // console.log(`##### Invoke - error: ${err}`);
      return shim.error(err);
    }
  }

  /**
   * Initialize the state. This should be explicitly called if required.
   *
   * @param {*} stub
   * @param {*} args
   */
  async initLedger(stub, args) {
    // console.log('============= START : Initialize Ledger ===========');
    // console.log('============= END : Initialize Ledger ===========');
  }

  // TODO: check the input
  async createAccount(stub, args) {
    // console.log('============= START : createAccount ===========');
    // console.log(`##### createAccount arguments: ${JSON.stringify(args)}`);

    const account = JSON.parse(args);
    const key = `${ACCOUNT_PREFIX}${account.accountId}`;
    account.lastUpdate = new Date().toUTCString();

    // console.log(`##### createAccount account: ${JSON.stringify(account)}`);

    await stub.putState(key, Buffer.from(JSON.stringify(account)));

    // Create a transaction for this account
    await createTransaction(stub, {
      accountId: account.accountId, amount: account.amount, type: DEPOSIT_TYPE, date: account.date,
    });
    // console.log('============= END : createAccount ===========');
  }

  async queryAccount(stub, args) {
    return stub.getState(`${ACCOUNT_PREFIX}${JSON.parse(args).accountId}`);
  }

  async queryAccounts(stub, args) {
    const { startAccountId, endAccountId } = JSON.parse(args);
    const iterator = await stub.getStateByRange(`${ACCOUNT_PREFIX}${startAccountId}`, `${ACCOUNT_PREFIX}${endAccountId}`);
    return parseResults(iterator);
  }

  async fetchAllAccount(stub) {
    const iterator = await stub.getStateByRange(`${ACCOUNT_PREFIX}0`, `${ACCOUNT_PREFIX}z`);
    return parseResults(iterator);
  }

  async fetchTransactions(stub, args) {
    const { accountId } = JSON.parse(args);
    const iterator = await stub.getStateByRange(`${TRANSACTION_PREFIX}${accountId}_0`, `${TRANSACTION_PREFIX}${accountId}_z`);
    return parseResults(iterator);
  }
};

// shim.start(new Account());
module.exports = Account;
