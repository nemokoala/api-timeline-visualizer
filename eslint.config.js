import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * 타입 정보 없는(non type-checked) 기본 구성.
 * 타입이 필요한 규칙(no-floating-promises 등)은 tsc가 이미 잡는 것과 겹치고
 * 린트가 느려져 넣지 않았다 — 필요해지면 recommendedTypeChecked로 올린다.
 */
export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.chrome },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Vite HMR은 컴포넌트만 export하는 모듈에서만 동작한다. 상수를 함께 export하는
      // 기존 파일이 있어 경고로만 둔다(빌드는 막지 않는다).
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // 쓰지 않는 인자는 _ 접두사로 의도를 밝힌다.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // 아래 넷은 React Compiler 기반의 새 규칙(eslint-plugin-react-hooks v7)이다. 지금 코드가
      // 걸리는 곳 대부분은 의도한 패턴 — 렌더 중 latestRef.current에 최신값을 담아 effect가
      // "값이 바뀔 때"가 아니라 "트리거가 바뀔 때"만 돌게 하는 식(DataTable의 rowIndexByIdRef 등).
      // 진짜 고칠 값어치가 있는지는 하나씩 따져 봐야 해서, 우선 경고로 두고 백로그로 넘긴다
      // (docs/feature-ideas.md 후속 정리 대상). 새로 짜는 코드에서는 경고를 보고 피하면 된다.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  // 페이지 컨텍스트에 주입되는 스크립트·설정 파일은 Node/페이지 전역을 함께 쓴다.
  {
    files: ['vite.config.ts', 'background.ts', 'devtools.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, ...globals.chrome } },
  },
);
