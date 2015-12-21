/**
 * Created by pchanthi on 09/12/15.
 */
module.exports = {
    astNodes : {
        PROGRAM: 'Program',
        FUNCTION_DECLARATION: 'FunctionDeclaration',
        FUNCTION_EXPRESSION: 'FunctionExpression',
        VARIABLE_DECLARATOR: 'VariableDeclarator',
        ASSIGNMENT_EXPRESSION: 'AssignmentExpression',
        UPDATE_EXPRESSION: "UpdateExpression",
        CALL_EXPRESSION: "CallExpression",
        RETURN_STATEMENT: 'ReturnStatement',
        EXPRESSION_STATEMENT: 'ExpressionStatement'

    },
    tempReturnVariable: 'var tempReturnVar = $XXYY$',
    returnTempVariable: {
        type: 'Identifier',
        name: 'tempReturnVar'
    },
    returnTempBlock: {
        type: 'BlockStatement',
        body: []
    }
};