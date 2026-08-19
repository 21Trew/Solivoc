let adapterPromise;
module.exports.handler = async function handler(event, context) {
  adapterPromise ||= import("./adapter.mjs");
  const adapter = await adapterPromise;
  return adapter.handler(event, context);
};
