/* eslint-disable no-await-in-loop */
/* eslint-disable class-methods-use-this */
const shim = require('fabric-shim');
// const uuidv1 = require('uuid/v1');

const ACCOUNT_PREFIX = 'a_';
const TRANSACTION_PREFIX = 't_';
const DEPOSIT_TYPE = 'DEPOSIT';
const WITHDRAW_TYPE = 'WITHDRAW';
const INTEREST_TYPE = 'INTEREST';

const ANNUAL_INTEREST_RATE = 0.02;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

async function createTransaction(stub, {
  accountId, amount, type, date,
}) { // appends a timestamp plus a 0 - 99 random number for the transaction key
  return stub.putState(`${TRANSACTION_PREFIX}${accountId}_${Date.now()}${Math.floor(Math.random() * 100)}`, Buffer.from(JSON.stringify({
    type, date, amount,
  })));
}

async function parseAccounts(iterator) {
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

async function parseTransations(iterator) {
  const results = [];
  while (true) {
    const res = await iterator.next();
    if (res.value && res.value.value.toString()) {
      try {
        results.push({ key: res.value.key, ...JSON.parse(res.value.value.toString('utf8')) });
      } catch (err) {
        results.push({ key: res.value.key, value: res.value.value.toString('utf8') });
      }
    }
    if (res.done) {
      await iterator.close();
      return Buffer.from(JSON.stringify(results));
    }
  }
}

// a and b are javascript Date objects
function dateDiffInDays(data1, data2) {
  // Discard the time and time-zone information.
  const utc1 = Date.UTC(data1.getFullYear(), data1.getMonth(), data1.getDate());
  const utc2 = Date.UTC(data2.getFullYear(), data2.getMonth(), data2.getDate());
  return Math.floor((utc2 - utc1) / MS_PER_DAY);
}

function calculateInterest(currentBalance, startDate, endDate) {
  return ((currentBalance * 100) * Math.floor(dateDiffInDays(startDate, endDate) / 365 * 100) * (ANNUAL_INTEREST_RATE * 100)) / 1000000;
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
      accountId: account.accountId, amount: account.balance, type: DEPOSIT_TYPE, date: account.lastUpdate,
    });
    // console.log('============= END : createAccount ===========');
  }

  async queryAccount(stub, args) {
    return stub.getState(`${ACCOUNT_PREFIX}${JSON.parse(args).accountId}`);
  }

  async queryAccounts(stub, args) {
    const { startAccountId, endAccountId } = JSON.parse(args);
    const iterator = await stub.getStateByRange(`${ACCOUNT_PREFIX}${startAccountId}`, `${ACCOUNT_PREFIX}${endAccountId}`);
    return parseAccounts(iterator);
  }

  async fetchAllAccount(stub) {
    const iterator = await stub.getStateByRange(`${ACCOUNT_PREFIX}0`, `${ACCOUNT_PREFIX}z`);
    return parseAccounts(iterator);
  }

  async fetchTransactions(stub, args) {
    const { accountId } = JSON.parse(args);
    const iterator = await stub.getStateByRange(`${TRANSACTION_PREFIX}${accountId}_0`, `${TRANSACTION_PREFIX}${accountId}_z`);
    return parseTransations(iterator);
  }

  async deposit(stub, args) {
    const { accountId, amount } = JSON.parse(args);
    const today = new Date();
    const dateString = today.toUTCString();

    const account = JSON.parse(await stub.getState(`${ACCOUNT_PREFIX}${accountId}`));

    // Added interest first and than add deposit amount
    const interest = calculateInterest(account.balance, new Date(account.lastUpdate), today);
    account.balance = (account.balance * 100 + amount * 100 + interest * 100) / 100;

    account.lastUpdate = dateString;

    // update the account
    await stub.putState(`${ACCOUNT_PREFIX}${account.accountId}`, Buffer.from(JSON.stringify(account)));

    // Create a transaction for the interest
    await createTransaction(stub, {
      accountId, amount: interest, type: INTEREST_TYPE, date: dateString,
    });
    // Create a transaction for this deposit
    await createTransaction(stub, {
      accountId, amount, type: DEPOSIT_TYPE, date: dateString,
    });
  }

  async withdraw(stub, args) {
    const { accountId, amount } = JSON.parse(args);
    const today = new Date();
    const dateString = today.toUTCString();
    const account = JSON.parse(await stub.getState(`${ACCOUNT_PREFIX}${accountId}`));

    // Calculate the interest based on old amount and last update date
    const interest = calculateInterest(account.balance, new Date(account.lastUpdate), today);
    account.balance = (account.balance * 100 - amount * 100 + interest * 100) / 100;

    account.lastUpdate = dateString;

    // update the account
    await stub.putState(`${ACCOUNT_PREFIX}${account.accountId}`, Buffer.from(JSON.stringify(account)));

    // Create a transaction for the interest
    await createTransaction(stub, {
      accountId, amount: interest, type: INTEREST_TYPE, date: dateString,
    });
    // Create a transaction for this withdraw
    await createTransaction(stub, {
      accountId, amount, type: WITHDRAW_TYPE, date: dateString,
    });
  }
};

// shim.start(new Account());
module.exports = Account;
