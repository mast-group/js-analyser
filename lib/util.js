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
        RETURN_STATEMENT: 'ReturnStatement'
    },
    tempReturnVariable: 'var tempReturnVar = $XXYY$',
    returnTempVariable: {
        type: 'Identifier',
        name: 'tempReturnVar'
    }
};