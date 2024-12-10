# Mark all targets as .PHONY since we want them to run every time
.PHONY: all _base-image k8s-normalize helm3 kustomize npm-install npm-run

all: _base-image k8s-normalize helm3 kustomize npm-install npm-run

_base-image:
	docker build . -f $@/Dockerfile -t ghcr.io/hologit/lenses/base:node-20

k8s-normalize: _base-image
	docker build . -f $@/Dockerfile -t ghcr.io/hologit/lenses/k8s-normalize:latest

helm3: _base-image
	docker build . -f $@/Dockerfile -t ghcr.io/hologit/lenses/helm3:latest

kustomize: _base-image
	docker build . -f $@/Dockerfile -t ghcr.io/hologit/lenses/kustomize:latest

npm-install: _base-image
	docker build . -f $@/Dockerfile -t ghcr.io/hologit/lenses/npm-install:latest

npm-run: _base-image
	docker build . -f $@/Dockerfile -t ghcr.io/hologit/lenses/npm-run:latest
