import type { UserConfig } from '@hey-api/openapi-ts';

const config: UserConfig = {
  input: '../../packages/api-contract/openapi.json',
  output: {
    clean: true,
    path: 'src/generated/api',
  },
};

export default config;
