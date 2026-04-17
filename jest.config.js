module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          outDir: './dist-test',
          rootDir: './',
          esModuleInterop: true,
          strict: true,
          target: 'es2022',
          module: 'commonjs',
          lib: ['es2022'],
          skipLibCheck: true,
          resolveJsonModule: true,
        },
      },
    ],
  },
};
