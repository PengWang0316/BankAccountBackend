const RealDate = Date;

export const mockDate = (dateStr) => {
  const dateToUse = new RealDate(dateStr);
  const _Date = Date;
  global.Date = jest.fn(() => dateToUse);
  global.Date.UTC = _Date.UTC;
  global.Date.parse = _Date.parse;
  global.Date.now = _Date.now;
  return dateToUse;
};

export const resetDateObject = () => {
  global.Date = RealDate;
};
