import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

// Next.js 16에서 `next lint`가 제거되어 ESLint 9 flat config로 직접 실행한다.
// 규칙 구성은 기존 .eslintrc.json의 "next/core-web-vitals" + "next/typescript"와 동일하고,
// `next lint`가 앱 소스만 검사했던 범위를 ignores로 재현한다.
const config = [
    {
        ignores: [
            '.next/**',
            'node_modules/**',
            'out/**',
            'build/**',
            'next-env.d.ts',
            // 일회성 점검/마이그레이션 스크립트 (앱 소스 아님)
            'tmp/**',
            'tmp_test*.js',
            'clear_hifitidal.js',
            'lint_report.txt',
        ],
    },
    ...nextCoreWebVitals,
    ...nextTypeScript,
    {
        rules: {
            // 배열 구조분해에서 `_`는 의도적인 자리표시자로 취급한다.
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    destructuredArrayIgnorePattern: '^_',
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
        },
    },
    {
        // 루트 설정 파일과 scripts/의 Node 스크립트는 CommonJS를 쓴다.
        files: ['*.js', '*.cjs', 'scripts/**/*.{js,cjs,mjs,ts}'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    },
];

export default config;
