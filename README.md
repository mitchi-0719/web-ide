# Nand2Tetris ハードウェア自主ゼミ

基本ゲートから Hack Computer までを HDL で組み立て、自分で書いた Hack アセンブリを動かす。加算回路は、機能をテストで確認した上で NAND 数と最大論理段数を比較する。

[ゼミ資料（esa）](https://vdslab.esa.io/posts/9134) · [Nand2Tetris 公式教材](https://www.nand2tetris.org/course)

## セットアップ

Node.js 24.16.0 と npm 10 以上を用意し、リポジトリのルートで一度実行する。Windows では WSL などのシェルを使う。

```sh
./check setup
```

Java、ブラウザの起動、グローバルインストールは不要。依存関係を取得する初回は npm レジストリへの接続が必要。

## ゼミで使うファイル

| 回 | 公式教材 | ファイル・主題 |
| --- | --- | --- |
| 1 | [Project 1](https://www.nand2tetris.org/project01) | `And`、`Xor`、`Mux` |
| 2 | [Project 2](https://www.nand2tetris.org/project02) | `HalfAdder`、`FullAdder`、`Add16`、`ALU` |
| 3 | [Project 3](https://www.nand2tetris.org/project03) | `Bit`、`Register`、`PC` |
| 4 | [Project 4](https://www.nand2tetris.org/project04)、[Project 6](https://www.nand2tetris.org/project06) | Hack ASM と既存アセンブラの利用 |
| 5 | [Project 5](https://www.nand2tetris.org/project05) | `CPU.hdl` |
| 6 | [Project 5](https://www.nand2tetris.org/project05) | `Computer.hdl` とプログラムの実行 |

`seminar/hardware/` に対象の公式 HDL スターターとテストを置いている。自作した部品は同じフォルダから読み込まれる。存在しない部品は、対応する組み込み部品があればそちらを使う。まだ作っていない部品を組み込みで代用する場合は、未完成の HDL をテスト対象と同じフォルダに置かず、必要なファイルだけを作業用フォルダにコピーする。DFF、ROM32K、Memory などは組み込みを利用できる。

## 実行コマンド

迷ったら `./check` でコマンド一覧を表示できる。

```sh
./check And           # HDL の公式テスト
./check cpu Add       # 既存 CPU で ASM を実行し、RAM の結果を比較
./check assemble Add  # seminar/programs/Add.hack を生成
./check computer Add  # ASM を自作 Computer で実行し、結果を比較
```

短い名前は HDL なら `seminar/hardware/`、ASM なら `seminar/programs/` を探す。別の場所に置いたファイルはパスで指定できる。HDLとCPUのテストは、既定ではソースと同名の `.tst`・`.cmp` を使う。別名の場合は両方のパスを指定する。CPU用テストでクロックを進める命令は `ticktock`。

`./check computer Foo` は `seminar/programs/Foo.asm` と `seminar/hardware/Computer.hdl`、`ComputerFoo.tst`、`ComputerFoo.cmp` を使う。テスト内には `ROM32K load Foo.hack` を指定する。変換した機械語は直接ROMに渡すので、既存の `.hack` は上書きされない。パスをすべて指定する場合は `./check computer source.asm Computer.hdl test.tst expected.cmp`。Computerの回路を実装してから使う。

比較不一致やファイルエラーでは終了コード1を返す。スターターは未完成なので、個別テストの合格には対象チップの実装が必要。

## ツール自体の動作確認

`./check verify` は教材とシミュレータをビルドし、HDL・ASM・自作Computerの実行をサンプルで確認する。自分の回路を確認するときは `./check And` のように対象を指定する。

NAND数・最大論理段数の計測器は別途用意する。

このリポジトリは [nand2tetris/web-ide](https://github.com/nand2tetris/web-ide) をベースにしている。元の説明は [UPSTREAM.md](UPSTREAM.md)、開発手順は [DEVELOPMENT.md](DEVELOPMENT.md) を参照。
