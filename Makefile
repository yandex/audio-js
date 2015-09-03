NPM_BIN=$(CURDIR)/node_modules/.bin
BUILDDIR=./dist

NODE=/usr/bin/env node

UGLIFY_JS=$(NPM_BIN)/uglifyjs --mangle --compress --bare-returns --stats
BROWSERIFY=$(NPM_BIN)/browserify -d


all: clean build minify


clean:
	@rm -rf -- $(BUILDDIR)


build: clean
	@mkdir -p -- $(BUILDDIR)
	$(BROWSERIFY) ./src/index.js > $(BUILDDIR)/index.js
	cp ./src/flash/build/player-2_0.swf $(BUILDDIR)/player-2_0.swf


minify: build
	$(UGLIFY_JS) $(BUILDDIR)/index.js > $(BUILDDIR)/index.min.js --source-map $(BUILDDIR)/index.map.json


.PHONY: all clean build minify
