# thundersnore

Thunderstore WEBFISHING mod validator.

![Screenshot of a Discord conversation where Jade tells me to use Deno](https://fxdiscord.com/i/832odclf.png)

## Usage

- Install Deno
- Install [Godot RE Tools](https://github.com/bruvzg/gdsdecomp) and set `GDRE_TOOLS_PATH` to the executable path
- `deno run start`

## Updating the file list

- Use Godot RE Tools to decompile WEBFISHING
- Set `DECOMP_PATH` to the decompiled project directory
- `deno run buildFileList`
