+++
title = 'Talks'
menu = "main"
+++

Some talks

- 2024 lambda zk week workshops: Building with the Herodotus Data Processor
  <!-- Button to open PDF -->
  <button id="toggleButton" onclick="togglePDF()">Open PDF</button>

<!-- Container for embedded PDF -->
<div id="pdfContainer" style="display:none; margin-top: 10px;">
  <iframe id="pdfFrame" src="/pdf/lambda_zk_week.pdf" width="100%" height="500px"></iframe>
</div>

<script>
  function togglePDF() {
    var container = document.getElementById('pdfContainer');
    var button = document.getElementById('toggleButton');
    if (container.style.display === 'block') {
      container.style.display = 'none';
      button.innerText = 'Open PDF';
    } else {
      container.style.display = 'block';
      button.innerText = 'Close PDF';
    }
  }
</script>

<style>
  #toggleButton {
    background-color: #007bff;
    color: white;
    border: none;
    padding: 8px 10px;
    border-radius: 5px;
    cursor: pointer;
  }
  #toggleButton:hover {
    background-color: #0056b3;
  }
</style>

- Deep dive in proof systems with Pia from Herodotus.dev: [youtube](https://www.youtube.com/watch?v=2GHI0Y92Vfg)
