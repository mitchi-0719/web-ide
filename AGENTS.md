# Nand2Tetris ゼミの作業ガイド

- セットアップは Node.js 24.16.0 と `./check setup`。Javaやグローバルツールは不要。
- 参加者の作業対象は `seminar/hardware/*.hdl` と `seminar/programs/*.asm`。対象の部品、入出力仕様、公式テストを確認してから編集する。
- HDLは `./check And` で検証する。同名の `.tst`・`.cmp` がない場合は、両方のパスを続けて渡す。終了コードと最初にずれた出力を確認する。
- Hack ASMは `./check cpu Add` で検証する。ROM用の機械語は `./check assemble Add` で生成する。
- 自作ComputerでASMを検証するときは `./check computer Add`。既定では `ComputerAdd.tst` と `ComputerAdd.cmp` を使う。
- HDLテストでは対象HDLと同じフォルダにある部品が優先される。未実装の部品が必要なときは一時フォルダで依存関係を絞る。公式の期待値やシミュレータを変えて課題を合格させない。
- 配布ツールを変更した場合は `./check verify`。個別課題の変更では対象の公式テストを実行する。追加の検証が必要なら独立したテストを作る。
- 上流のコードを変更するときは [DEVELOPMENT.md](DEVELOPMENT.md) に従う。フォーマット、型検査、テストはnpmスクリプト経由で実行し、生成済みの `build/`・`dist/` は直接編集しない。
