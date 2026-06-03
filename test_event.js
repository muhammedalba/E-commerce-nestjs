const { EventEmitter2 } = require('eventemitter2');

const eventEmitter = new EventEmitter2();

eventEmitter.on('test', async () => {
  throw new Error('Listener threw an error');
});

async function main() {
  try {
    const results = await eventEmitter.emitAsync('test');
    console.log('Resolved with:', results);
  } catch (error) {
    console.log('Caught error:', error.message);
  }
}

main();
