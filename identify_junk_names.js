/**
 * Created by Pankajan on 18/04/2016.
 */
/**
 * Created by Pankajan on 08/12/2015.
 */
var fs = require('fs-extra');
var esprima = require('esprima');
var estraverse = require('estraverse');
var escodegen = require('escodegen');
var util = require('./lib/util');
var path = require('path');
var request = require("request");


var rootFilename = "/Users/Pankajan/Edinburgh/Research_Source/Original/";
var results = {};
var stack = [];

process(rootFilename);


function process(filename) {
    stack.push(rootFilename);
    var stat = fs.lstatSync(filename);
    if(stat.isDirectory()) {
        if(filename.indexOf('node_modules')==-1 && filename.indexOf('/test')==-1 && filename.indexOf('__tests__')==-1) {
            fs.readdir(filename, function (err, files) {
                files.forEach(function (file) {
                    process(filename + "/" + file);
                });
                stack.pop();
                if(stack.length==0) {
                    printResults();
                }
            });
        } else {
            stack.pop();
        }
    } else {
        stack.pop();
        if(stat.isFile() && path.extname(filename)==='.js') {
            try {
                instrument(filename);
            } catch (err) {
            }
        }
    }

}

var currentProject;

function instrument(filename) {
    currentProject = filename.split(rootFilename)[1].split("/")[1];
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
        enter: enter,
        leave: leave
    });

    /* var result = estraverse.replace(ast, {
     leave: replace
     });*/

    return escodegen.generate(ast);
}

var scopeChain = [];
var modifiedVariables=[];
var calledMethods=[];


function enter(node, parent) {
    if (createsNewScope(node)){
        scopeChain.push([]);
        var params = node.params;

        if(params!=undefined) {
            for (i = 0; i < params.length; i++) {
                storeIfJunk(params[i].name, true);
            }
        }
    } else if (node.type === util.astNodes.VARIABLE_DECLARATOR){
        storeIfJunk(node.id.name, true);
    } else if (node.type === util.astNodes.ASSIGNMENT_EXPRESSION){
        storeIfJunk(node.left.name, false);
    } else if (node.type === util.astNodes.UPDATE_EXPRESSION) {
        storeIfJunk(node.argument.name, false);
    } else if (node.type === util.astNodes.EXPRESSION_STATEMENT) {
        modifiedVariables=[];
        calledMethods=[];
    }
}

var junkResults = {};

function storeIfJunk(name, initialised) {
    if (!(name in junkResults)) {
        var identifiedJunk = (name.length < 3) || (isLowerCase(name) && isJunk(name));
        if(identifiedJunk) {
            if (!(name in results)) {
                results[name] = {};
            }
            if (!(currentProject in results[name])) {
                results[name][currentProject] = {intialisedTimes:0, calledTimes:0};
            }
            if(initialised) {
                results[name][currentProject].intialisedTimes += 1;
            }
            results[name][currentProject].calledTimes += 1;
        }
        junkResults[name] = identifiedJunk;
    } else {
        return junkResults[name];
    }

}

function isJunk(name) {
    var finished = false;
    var result = true;
    var url = "http://api.wordnik.com/v4/word.json/"+name+"/relatedWords?useCanonical=false&relationshipTypes=synonym&limitPerRelationshipType=1&api_key=566e20b3229dbb299d1080a14df0540cc4527288de9d4cc79";
    request({
        url: url,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            result =  body['words'] == null;
        } else {
            result = true;
        }
        finished= true;
    });
    setTimeout(function() { finished = true }, 10000);
    while(!finished) {}
    return result;
}

function isLowerCase(str) {
    return str === str.toLowerCase();
}

function leave(node, parent){
    if (createsNewScope(node)){
        scopeChain.pop();
    } else if (node.type === util.astNodes.EXPRESSION_STATEMENT) {
        modifiedVariables=[];
        calledMethods=[];
    }
}

function createsNewScope(node){
    return node.type === util.astNodes.FUNCTION_DECLARATION ||
        node.type === util.astNodes.FUNCTION_EXPRESSION ||
        node.type === util.astNodes.PROGRAM;
}


function printResults() {
    var outputFilename = '/Users/Pankajan/Edinburgh/my.json';

    fs.writeFile(outputFilename, JSON.stringify(results, null, 4), function(err) {
        if(err) {
            console.log(err);
        } else {
            console.log("JSON saved to " + outputFilename);
        }
    });
}
