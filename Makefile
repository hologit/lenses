# Mark all targets as .PHONY since we want them to run every time
.PHONY: all _base-image k8s-normalize helm3 kustomize npm-install npm-run

all: _base-image k8s-normalize helm3 kustomize npm-install npm-run

_base-image:
	docker build $@ -t ghcr.io/hologit/lenses/base:node-20

k8s-normalize: _base-image
	docker build . -t ghcr.io/hologit/lenses/k8s-normalize:latest -f $@/Dockerfile

helm3: _base-image
	docker build . -t ghcr.io/hologit/lenses/helm3:latest -f $@/Dockerfile

kustomize: _base-image
	docker build . -t ghcr.io/hologit/lenses/kustomize:latest -f $@/Dockerfile

npm-install: _base-image
	docker build . -t ghcr.io/hologit/lenses/npm-install:latest -f $@/Dockerfile

npm-run: _base-image
	docker build . -t ghcr.io/hologit/lenses/npm-run:latest -f $@/Dockerfile
