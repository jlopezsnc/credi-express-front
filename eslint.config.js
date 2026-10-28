import js from '@eslint/js';
import angular from 'angular-eslint';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      '.angular',
      'coverage',
      'playwright-report',
      'test-results',
      'src/app/core/api/schema.d.ts',
      'src/environments/env.ts',
    ],
  },
  {
    files: ['src/**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...angular.configs.tsRecommended,
      prettier,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      // Reglas OWASP del proyecto (docs §5.2)
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.property.name=/^bypassSecurityTrust/]',
          message: 'Prohibido bypassSecurityTrust* (desactiva la protección XSS de Angular).',
        },
        {
          selector:
            "Decorator[expression.callee.name='Component'] Property[key.name=/^(styles|styleUrl|styleUrls)$/]",
          message:
            'Sin estilos por componente: Angular los inyecta en línea y la CSP los bloquea. Usa clases de Tailwind.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'localStorage',
          property: 'setItem',
          message:
            'No guardar tokens ni datos personales en localStorage; el SDK de Firebase administra la sesión.',
        },
      ],
      'no-eval': 'error',
      '@typescript-eslint/no-implied-eval': 'error',
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      // Falso positivo con los validadores estáticos de Angular (`Validators.required`).
      '@typescript-eslint/unbound-method': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['src/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      // Atributos style en línea: la CSP (style-src 'self') los bloquea.
      '@angular-eslint/template/no-inline-styles': 'error',
      '@angular-eslint/template/prefer-control-flow': 'error',
    },
  },
);
