// Test file for code review - contains intentional issues

// Security issue: hardcoded API key
const API_KEY = "sk-1234567890abcdef";

// Bug: SQL injection vulnerability
function getUser(username) {
  const query = `SELECT * FROM users WHERE name = '${username}'`;
  return db.execute(query);
}

// Refactor: Function too complex
function processData(data) {
  if (data) {
    if (data.valid) {
      if (data.user) {
        if (data.user.active) {
          if (data.user.permissions) {
            console.log("Processing valid user");
            return true;
          }
        }
      }
    }
  }
  return false;
}

// Suggestion: Using var instead of const/let
var oldStyleVariable = "should use const or let";

// Suggestion: String concatenation instead of template literals
const message = "Hello " + username + "!";

console.log("Test complete");
