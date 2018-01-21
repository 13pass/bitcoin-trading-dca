'use strict';

const cron = require('node-cron');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function trade() {
	const { stdout, stderr } = await exec('node trading.js');
	console.log('stdout:', stdout);
	console.log('stderr:', stderr);
}
 
cron.schedule('*/5 * * * *', async function (){
	console.log('running every 5 minutes');
	await trade();
});
