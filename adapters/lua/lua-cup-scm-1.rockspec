package = "lua-cup"
version = "scm-1"
source = { url = "git://example.invalid/lua-cup" }
build = { type = "builtin", modules = { ["cup"] = "lua/cup.lua" } }
