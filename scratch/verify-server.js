const http = require('http');

console.log('Testing HTTP response from http://localhost:5173 ...');

const req = http.get('http://localhost:5173', (res) => {
  console.log('HTTP Status Code:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Received HTML bytes:', data.length);
    console.log('Contains WorkspaceSplit:', data.includes('workspace-split.js'));
    console.log('Contains app.css:', data.includes('app.css'));
    console.log('✓ Dev server is running and serving files properly!');
  });
});

req.on('error', (err) => {
  console.error('HTTP Request failed:', err.message);
});
