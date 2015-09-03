NPM_BIN=$(CURDIR)/node_modules/.bin
BUILDDIR=./dist

NODE=/usr/bin/env node

UGLIFY_JS=$(NPM_BIN)/uglifyjs --mangle --compress --bare-returns
BROWSERIFY=$(NPM_BIN)/browserify -d

clean:
	@rm -rf -- $(BUILDDIR)

all: clean
	@mkdir -p -- $(BUILDDIR)
	$(BROWSERIFY) ./src/index.js > $(BUILDDIR)/index.js
	$(UGLIFY_JS) $(BUILDDIR)/index.js > $(BUILDDIR)/index.min.js


.PHONY: all clean