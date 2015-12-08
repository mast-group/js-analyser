var fs = require('fs');
var esprima = require('esprima');
var escope = require('escope');

var filename = process.argv[2];
var srcCode = fs.readFileSync(filename);

console.log("FILE CONTENT :::::::::::::::::::::::");
console.log(srcCode);
console.log("------------------- FILE END ------------------");

var ast = esprima.parse(srcCode, {
    loc: true
});

console.log(JSON.stringify(ast));

var globalScope = escope.analyze(ast).scopes[0];

globalScope.implicit.variables.forEach(function(v) {
var id = v.identifiers[0];
console.warn('"' + id.name + '" used at line : ' + id.loc.start.line + ' was not declared');
});
