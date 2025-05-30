#!/usr/bin/env tsx
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

async function setup() {
  console.log(chalk.blue('🚀 Setting up Financial Agent System...'));
  
  try {
    // data ディレクトリ作成
    const dataDir = path.join(projectRoot, 'data');
    await fs.mkdir(dataDir, { recursive: true });
    console.log(chalk.green('✅ Created data directory'));
    
    // logs ディレクトリ作成
    const logsDir = path.join(projectRoot, 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    console.log(chalk.green('✅ Created logs directory'));
    
    // .env ファイルの作成（存在しない場合）
    const envPath = path.join(projectRoot, '.env');
    const envExamplePath = path.join(projectRoot, '.env.example');
    
    try {
      await fs.access(envPath);
      console.log(chalk.yellow('⚠️  .env file already exists'));
    } catch {
      try {
        const envExample = await fs.readFile(envExamplePath, 'utf-8');
        await fs.writeFile(envPath, envExample);
        console.log(chalk.green('✅ Created .env file from .env.example'));
      } catch {
        // .env.example が存在しない場合は基本的な .env を作成
        const basicEnv = `# Alpha Vantage API Key (株価データ用)
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key_here

# その他の設定
NODE_ENV=development
LOG_LEVEL=info
`;
        await fs.writeFile(envPath, basicEnv);
        console.log(chalk.green('✅ Created basic .env file'));
      }
    }
    
    // TypeScript設定の確認
    const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
    try {
      await fs.access(tsconfigPath);
      console.log(chalk.green('✅ tsconfig.json exists'));
    } catch {
      console.log(chalk.red('❌ tsconfig.json not found'));
    }
    
    console.log('\n' + chalk.blue('📋 Next steps:'));
    console.log('1. ' + chalk.yellow('Edit .env file and add your API keys'));
    console.log('   - Get Alpha Vantage API key: https://www.alphavantage.co/support/#api-key');
    console.log('2. ' + chalk.yellow('Run: npm run build'));
    console.log('3. ' + chalk.yellow('Run: npm run start-mcp-servers (in separate terminal)'));
    console.log('4. ' + chalk.yellow('Run: npm run analyze'));
    
  } catch (error) {
    console.error(chalk.red('❌ Setup failed:'), error);
    process.exit(1);
  }
}

setup();