function startScanner() {
  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: document.querySelector("#scanner-container"),
      constraints: {
        facingMode: "environment"
      }
    },
    decoder: {
      readers: ["upc_reader", "ean_reader", "code_128_reader", "code_39_reader"]
    }
  }, function (err) {
    if (err) {
      console.error(err);
      return;
    }
    Quagga.start();
  });

  Quagga.onDetected(data => {
    if (data && data.codeResult) {
      alert("Scanned code: " + data.codeResult.code);
      Quagga.stop();
    }
  });
}
