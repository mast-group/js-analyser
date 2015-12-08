  var parser = require('uglify-js');
  var fs = require('fs');
  var filename = process.argv[2];
var ast = parser.parse(String(fs.readFileSync(filename)));


console.log(JSON.stringify(ast));



