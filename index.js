const { readFileSync, writeFileSync, readdirSync, statSync } = require("fs");
const { join } = require("path");
const core = require("@actions/core");
const dollar_sign = require("@k3rn31p4nic/google-translate-api");
const unified = require("unified");
const parse = require("remark-parse");
const stringify = require("remark-stringify");
const visit = require("unist-util-visit");
const simpleGit = require("simple-git");
const git = simpleGit();

const toAst = (markdown) => {
  return unified().use(parse).parse(markdown);
};

const toMarkdown = (ast) => {
  return unified().use(stringify).stringify(ast);
};
const recFindByExt=(base,files,result) => {
    files = files || readdirSync(base) 
    result = result || [] 
    files.forEach( 
        function (file) {
            var newbase = path.join(base,file)
            if (statSync(newbase).isDirectory())
            {
                result = recFindByExt(newbase,readdirSync(newbase),result)
            }
            else
            {
                if (file.endsWith('.md') && !file.match(/\.[a-z]{2}(-[A-Z]{2})?\.md$/m)) // already translated
                {
                    result.push(newbase);
                } 
            }
        }
    )
    return result
}

const mainDir = ".";
let FILES = recFindByExt(mainDir);
console.log("FILES");
console.log(FILES);
const lang = core.getInput("LANG") || "en";
//let README = readdirSync(mainDir).includes("readme.md")? "readme.md": "README.md";



  async function writeToFile(file_part,translatedText,readmeAST) {
    await Promise.all(translatedText);
    writeFileSync(
      join(mainDir, `${file_part}.${lang}.md`),
      toMarkdown(readmeAST),
      "utf8"
    );
    console.log(`${file_part}.${lang}.md written`);
  }

  async function commitChanges(file_part,lang) {
    console.log("commit started");
    await git.add("./*");
    await git.addConfig("user.name", "github-actions[bot]");
    await git.addConfig(
      "user.email",
      "41898282+github-actions[bot]@users.noreply.github.com"
    );
    await git.commit(
      `docs: Added ${file_part}."${lang}".md translation via https://github.com/dephraiim/translate-readme`
    );
    console.log("finished commit");
  }

  async function translateReadme() {
    try {
      for(file of FILES){
        const file_part = file.replace('.md','');
        const readme = readFileSync(join(mainDir, file), { encoding: "utf8" });
        const readmeAST = toAst(readme);
        console.log("AST CREATED AND READ");

        let originalText = [];

        visit(readmeAST, async (node) => {
          if (node.type === "text") {
            originalText.push(node.value);
            node.value = (await $(node.value, { to: lang })).text;
          }
        });

        const translatedText = originalText.map(async (text) => {
          return (await dollar_sign(text, { to: lang })).text;
        });
        await writeToFile(file_part,translatedText,readmeAST);
        await commitChanges(file_part,lang);
        console.log("commit",file_part,lang);
      }
      await git.push();
      console.log("pushed");
    } catch (error) {
      throw new Error(error);
    }
  }

  translateReadme();


