# Mark all targets as .PHONY since we want them to run every time
.PHONY: all _base-image k8s-normalize helm3

all: _base-image k8s-normalize helm3

_base-image:
	docker build -t ghcr.io/hologit/lenses/base:node-20 $@

k8s-normalize: _base-image
	docker build -t ghcr.io/hologit/lenses/k8s-normalize:latest $@

helm3: _base-image
	docker build -t ghcr.io/hologit/lenses/helm3:latest $@
