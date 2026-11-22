// jest.config.js
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],  👈 comente ou remova esta linha
  // testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1", // ajuste "src" para a pasta real onde ficam seus arquiv
  },
};

module.exports = createJestConfig(customJestConfig);
