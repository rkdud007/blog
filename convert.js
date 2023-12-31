const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

// Directory where your markdown files are located
const markdownDirectory = path.join(__dirname, 'content');

// Output directory for the HTML files
const outputDirectory = path.join(__dirname, 'blog');

// Read all markdown files from the content directory
fs.readdir(markdownDirectory, (err, files) => {
    if (err) {
        console.error("Could not list the directory.", err);
        process.exit(1);
    }

    files.forEach((file, index) => {
        const markdownFilePath = path.join(markdownDirectory, file);
        const outputFilePath = path.join(outputDirectory, file.replace('.md', '.html'));

        // Read markdown file content
        fs.readFile(markdownFilePath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Could not read file: ${markdownFilePath}`, err);
                return;
            }

            // Convert markdown content to HTML
            const htmlContent = marked(data);
            const baseFileName = path.basename(markdownFilePath, path.extname(markdownFilePath));

            const currentDate = new Date();
            const formattedDate = currentDate.toLocaleDateString("en-US", {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            const templatePath = path.join(__dirname, 'blog-template.html');
            const template = fs.readFileSync(templatePath, 'utf8');
            // Insert content into template\
            let output = template.replace('<p>Blog post date</p>', `<p>${formattedDate}</p>`);
            output = output.replace('<h1>Blog Post Title</h1>', `<h1>${baseFileName}</h1>`);
            const newHtmlContent = output.replace('<!-- Blog post content goes here -->', htmlContent);

            // Write the HTML content to a new file
            fs.writeFile(outputFilePath, newHtmlContent, 'utf8', (err) => {
                if (err) {
                    console.error(`Could not write HTML file: ${outputFilePath}`, err);
                    return;
                }

                console.log(`Converted ${markdownFilePath} to HTML: ${outputFilePath}`);
            });
        });
    });
});
