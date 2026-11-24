# Nand2Tetris 院ゼミ後半用リポジトリ

基本ゲートから Hack Computer までを HDL で組み立て、自分で書いた Hack アセンブリを動かす。加算回路は、機能をテストで確認した上で NAND 数と最大論理段数を比較する。

[ゼミ資料（esa）](https://vdslab.esa.io/posts/9134) · [Nand2Tetris 公式教材](https://www.nand2tetris.org/course)

## セットアップ

Node.js 24.16.0 と npm 10 以上を用意し、リポジトリのルートで一度実行する。Windows では WSL などのシェルを使う。

```sh
./check setup
```

Java、ブラウザの起動、グローバルインストールは不要。依存関係を取得する初回は npm レジストリへの接続が必要。

## 授業回と検証コマンド

| 回 | 一括検証 | 配布ファイル | 個別検証 | 公式教材 |
| --- | --- | --- | --- | --- |
| 1 | `./check lesson 1` | `And.hdl`、`Xor.hdl`、`Mux.hdl` | `./check And`、`./check Xor`、`./check Mux` | [Project 1](https://www.nand2tetris.org/project01) |
| 2 | `./check lesson 2` | `HalfAdder.hdl`、`FullAdder.hdl`、`Add16.hdl`、`ALU.hdl` | `./check HalfAdder`、`./check FullAdder`、`./check Add16`、`./check ALU` | [Project 2](https://www.nand2tetris.org/project02) |
| 3 | `./check lesson 3` | `Bit.hdl`、`Register.hdl`、`PC.hdl` | `./check Bit`、`./check Register`、`./check PC` | [Project 3](https://www.nand2tetris.org/project03) |
| 4 | `./check lesson 4` | `Add.asm` | `./check cpu Add` | [Project 4](https://www.nand2tetris.org/project04)、[Project 6](https://www.nand2tetris.org/project06) |
| 5 | `./check lesson 5` | `CPU.hdl` | `./check CPU` | [Project 5](https://www.nand2tetris.org/project05) |
| 6 | `./check lesson 6` | `Computer.hdl`、`Add.asm` | `./check computer Add` | [Project 5](https://www.nand2tetris.org/project05) |

第1〜3・5回の既定は単体検証、第6回の既定は統合検証。指定順にすべてのテストを試す。各回の対象を変える場合は [`seminar/lessons.mjs`](seminar/lessons.mjs) の `checks` を編集する。各項目に `hdl`、`cpu`、`computer` のいずれかと、個別検証と同じ引数を指定する。

第4回は配布済みの加算サンプルをゼミ用の `Add.tst`・`Add.cmp` で検証する。第6回は同じ ASM を公式の `ComputerAdd.tst`・`ComputerAdd.cmp` で検証する。条件分岐を含む自作 ASM のスターターと検証用テストは、ゼミ用フォルダに未配布。演習を追加するときは、ASM、CPU 用のテストと期待値、Computer でも動かす場合は Computer 用のテストと期待値を用意する。

### 単体検証と統合検証

```sh
./check ALU --isolated       # ALU.hdl を読み、依存部品に組み込み実装を使う
./check ALU --integrated     # 同じフォルダの自作依存部品を優先し、読み込み元を表示
./check lesson 2 --isolated
./check lesson 2 --integrated
./check computer Add --isolated
./check computer Add --integrated
```

- 単体検証では対象の HDL を読み、依存部品には組み込み実装を使う。同じフォルダの未完成 HDL があっても対象だけを確認できる。組み込み実装がない自作依存部品が必要なときは統合検証を使う。
- 統合検証では、同じフォルダの HDL を依存先までたどる。ファイルが見つからない部品は、組み込み実装があればそちらを使う。存在する未完成の HDL も読み込むため、依存部品が原因でテストが失敗することがある。出力の `DEP` 行は、ローカル HDL の参照先ごとに `LOCAL (パス)`、`BUILTIN (fallback)`、`BUILTIN (パス)`（ファイル内の明示指定）、`MISSING`、または読み込みエラーを示す。
- フラグなしの個別 HDL 検証と `./check computer Add` は従来どおり自作の依存部品を優先する。第4回は常に CPU エミュレータで ASM を実行する。

### 結果の読み方

- `PASS` は期待出力との一致、`FAIL` は出力不一致や解析・実行エラー。出力不一致では最初にずれた行・列と期待値・実際の値を表示する。
- 一括検証の `SKIP` は必要なソース、`.tst`、`.cmp` の欠落。理由とファイル名を表示し、後続のテストも実行する。
- 一括検証の末尾には `Passed`、`Failed`、`Skipped` と `Result` を表示する。全件合格で終了コード `0`、`FAIL` または `SKIP` があれば `1`。配布直後の未実装 HDL は失敗する。

### ファイルの指定と ASM の変換

短い名前で指定すると、HDL は `seminar/hardware/`、ASM は `seminar/programs/` を参照する。HDL と CPU エミュレータの検証では、既定でソースと同名の `.tst`・`.cmp` を使う。別名の場合はテストと期待値のパスを両方指定する。第5回で `DRegister` を使わない実装には、公式の代替テスト `CPU-external` がある。

```sh
./check CPU seminar/hardware/CPU-external.tst seminar/hardware/CPU-external.cmp --isolated
./check cpu path/to/source.asm path/to/source.tst path/to/expected.cmp
./check assemble Add  # seminar/programs/Add.hack を生成
./check computer path/to/source.asm path/to/Computer.hdl path/to/test.tst path/to/expected.cmp
```

`./check computer Foo` は `seminar/programs/Foo.asm` と `seminar/hardware/Computer.hdl`、`ComputerFoo.tst`、`ComputerFoo.cmp` を使う。テストには `ROM32K load Foo.hack` を指定する。変換した機械語は直接 ROM に渡すので、既存の `.hack` は上書きされない。CPU エミュレータ用テストでクロックを進める命令は `ticktock`。

### Codex・Claude Code での利用例

> `ALU.hdl` の入出力仕様と公式テストを確認し、`./check ALU --isolated` を実行して。失敗したら最初の不一致を説明し、必要な修正は `ALU.hdl` に限定して。次に `./check lesson 2 --integrated` で、結果の集計と組み込み部品にフォールバックした箇所を報告して。

## ツール自体の動作確認

`./check verify` は教材とシミュレータをビルドし、一時ファイルのサンプルで HDL・ASM・Computer と一括検証の動作を確認する。参加者の実装が未完成でも実行できる。`./check --help` でコマンド一覧を表示する。

NAND数・最大論理段数の計測器は別途用意する。

このリポジトリは [nand2tetris/web-ide](https://github.com/nand2tetris/web-ide) をベースにしている。元の説明は [UPSTREAM.md](UPSTREAM.md)、開発手順は [DEVELOPMENT.md](DEVELOPMENT.md) を参照。
