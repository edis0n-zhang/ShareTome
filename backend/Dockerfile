FROM golang:1.23-alpine AS build

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o main cmd/api/main.go

FROM python:3.12-slim-bookworm AS prod
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    cmake \
    make \
    git \
    # OpenCV dependencies
    libopencv-dev \
    python3-opencv \
    # Pillow dependencies
    libjpeg-dev \
    zlib1g-dev \
    libfreetype6-dev \
    liblcms2-dev \
    libopenjp2-7-dev \
    libtiff5-dev \
    tk-dev \
    tcl-dev \
    libharfbuzz-dev \
    libfribidi-dev \
    # PyArrow dependencies
    libboost-dev \
    libgflags-dev \
    bison \
    flex \
    libsnappy-dev \
    libbz2-dev \
    liblz4-dev \
    libzstd-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Arrow
RUN apt-get update && \
    apt-get install -y lsb-release wget && \
    wget https://apache.jfrog.io/artifactory/arrow/$(lsb_release --id --short | tr 'A-Z' 'a-z')/apache-arrow-apt-source-latest-$(lsb_release --codename --short).deb && \
    apt-get install -y -V ./apache-arrow-apt-source-latest-$(lsb_release --codename --short).deb && \
    apt-get update && \
    apt-get install -y libarrow-dev && \
    rm -rf /var/lib/apt/lists/* && \
    rm -f apache-arrow-apt-source-latest-$(lsb_release --codename --short).deb

# Create and activate virtual environment
ENV VIRTUAL_ENV=/app/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Copy and install Python requirements
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY --from=build /app/main /app/main
COPY internal/server/doc_upload.py internal/server/doc_upload.py
EXPOSE ${PORT}
CMD ["./main"]
