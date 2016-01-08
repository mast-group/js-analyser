/**
 * Created by Pankajan on 08/12/2015.
 */
var fs = require('fs-extra');
var esprima = require('esprima');
var estraverse = require('estraverse');
var escodegen = require('escodegen');
var util = require('./lib/util');
var path = require('path');

var PERSONAL_HOME = '/Users/Pankajan/';
var OFFICE_HOME = '/afs/inf.ed.ac.uk/user/p/pchanthi/';
var PERSONAL_LAP = PERSONAL_HOME + 'Edinburgh/Research_Source/';
var OFFICE = OFFICE_HOME + 'edinburgh/research_source/';

var ROOT = OFFICE;
var HOME = OFFICE_HOME;
var PROJECT = 'd3';

var filename = ROOT + PROJECT;  //process.argv[2];
var outFilename = ROOT + "instrumented-" + PROJECT;  //process.argv[2];
var LOG_FILE = HOME + 'log_' + PROJECT + '.txt';

process(filename, outFilename);

function process(filename, outFilename) {
    var stat = fs.lstatSync(filename);
    if(stat.isDirectory()) {
        if(filename.indexOf('node_modules')==-1 && filename.indexOf('/test/')==-1) {
            fs.mkdirSync(outFilename);
            fs.readdir(filename, function (err, files) {
                if (err) {
                    fs.copy(filename, outFilename, {});
                    return console.error(err);
                }
                files.forEach(function (file) {
                    process(filename + "/" + file, outFilename + "/" + file);
                });
            });
        } else {
            fs.copy(filename, outFilename, {});
        }
    } else {
        if(stat.isFile() && path.extname(filename)==='.js') {
            try {
                var newCode = instrument(filename);
                fs.writeFile(outFilename, newCode, function (err) {
                    if (err)fs.copy(filename, outFilename, {});
                });
            } catch (err) {
                console.log(err);
                fs.copy(filename, outFilename, {});
            }
        } else {
            fs.copy(filename, outFilename, {});
        }
    }
}

var currentFileName;

function instrument(filename) {
    currentFileName = filename;
    var srcCode = fs.readFileSync(filename, 'utf-8');
    if (srcCode.charAt(0) === '#') { //shebang, 'comment' it out, won't affect syntax tree locations for things we care about
        srcCode = '//' + srcCode;
    }
    var ast;
    try{
        ast = esprima.parse(srcCode, {
            range: true,
            tokens: true,
            comment: true
        });
    } catch (notAScript) {
        ast = esprima.parse(srcCode, {
            range: true,
            tokens: true,
            comment: true,
            sourceType: 'module'
        });
    }
    estraverse.traverse(ast, {
        enter: enter
    });
    return escodegen.generate(ast);
}

function enter(node) {
    if (node.type === util.astNodes.FUNCTION_DECLARATION ||
        node.type === util.astNodes.FUNCTION_EXPRESSION){
        var xx = "require('fs').appendFile('"+LOG_FILE+"', '" + currentFileName + "->'+" + node.range + ");";
        node.body.body.unshift(esprima.parse(xx));
        return node;
    }
}

