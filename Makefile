NPM_BIN=./node_modules/.bin
SOURCEDIR=src
BUILDDIR=dist

NODE=/usr/bin/env node

UGLIFY_JS=$(NPM_BIN)/uglifyjs --mangle --compress --bare-returns --stats
BROWSERIFY=$(NPM_BIN)/browserify -d


MAKEFLAGS+=-j 1


all: clean build minify


clean:
	rm -rf $(BUILDDIR)


build: clean $(BUILDDIR)/index.js
	cp $(SOURCEDIR)/flash/build/player-2_0.swf $(BUILDDIR)/player-2_0.swf


minify: $(BUILDDIR)/index.js
	$(UGLIFY_JS) $(BUILDDIR)/index.js > $(BUILDDIR)/index.min.js --source-map $(BUILDDIR)/index.map.json


$(BUILDDIR)/index.js:
	mkdir $(BUILDDIR)
	$(BROWSERIFY) $(SOURCEDIR)/index.js > $(BUILDDIR)/index.js


.PHONY: all clean build minify
