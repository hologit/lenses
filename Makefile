# Mark all targets as .PHONY since we want them to run every time
.PHONY: all _base-image k8s-normalize k8s-patch helm3 kustomize mkdocs npm-install npm-run shell

all: _base-image k8s-normalize k8s-patch helm3 kustomize mkdocs npm-install npm-run shell

_base-image:
	docker build . -f $@/Dockerfile -t ghcr.io/hologit/lenses/base:node-20

k8s-normalize: _base-image
	docker build . -f $@/Dockerfile -t ghcr.io/hologit/lenses/$@:latest

k8s-patch: _base-image
	docker build . -f $@/Dockerfile -t ghcr.io/hologit/lenses/$@:latest

helm3: _base-image
	docker build . -f $@/Dockerfile -t ghcr.io/hologit/lenses/$@:latest

kustomize: _base-image
	docker build . -f $@/Dockerfile -t ghcr.io/hologit/lenses/$@:latest

mkdocs: _base-image
	docker build . -f $@/Dockerfile -t ghcr.io/hologit/lenses/$@:latest

npm-install: _base-image
	docker build . -f $@/Dockerfile -t ghcr.io/hologit/lenses/$@:latest

npm-run: _base-image
	docker build . -f $@/Dockerfile -t ghcr.io/hologit/lenses/$@:latest

shell: _base-image
	docker build . -f $@/Dockerfile -t ghcr.io/hologit/lenses/$@:latest
