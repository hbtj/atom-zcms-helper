'use babel';

import prettyHTML from 'pretty';
import * as TAGS from './template-tags.json';
import * as ATTRS from './template-attributes.json';

// https://github.com/atom/autocomplete-plus/wiki/Provider-API
const provider = {
  // 选择器，指定工作的作用域范围，这里是只有在选择器 '.text.html' 作用域下才能工作, 如 html 文件有作用域 '.text.html.basic', vue 文件有作用域 '.text.html.vue' 都是包含于 '.text.html' 的
  selector: '.text.html',
  // 排除工作作用域中子作用域，如 html, vue 文件中的注释。可选
  disableForSelector: '.text.html .comment',
  // 表示提示建议显示优先级， 数字越高优先级越高，默认优先级是0。可选
  inclusionPriority: 1,
  // 如果为 true，那么根据 inclusionPriority 大小，高优先级就会阻止其他低优先级的建议服务提供者。可选
  excludeLowerPriority: true,
  // 在提示下拉选项中的排序, 默认为 1，数字越高越靠前。可选
  suggestionPriority: 2,

  filterSuggestions: true,
  attrReg: /\s+[:@]*([a-zA-Z][-a-zA-Z]*)\s*=\s*$/,
  tagReg: /<([a-zA-Z][-:a-zA-Z]*)(?:\s|$)/,
  bindReg: /\s+:$/,
  methodReg: /^\s+@$/,

  // 返回一个 promise 对象、包含提示的数组或者 null。这里返回提示列表给 autocomplete+ 提供的服务展示，我们不用关心如何展示
  getSuggestions(request) {
    if (this.isAttrValueStart(request)) {
      return this.getAttrValueSuggestion(request);
    } else if (this.isAttrStart(request)) {
      return this.getAttrSuggestion(request);
    } else if (this.isTagStart(request)) {
      return this.getTagSuggestion(request);
    } else {
      return [];
    }
  },
  // provide 提供的建议（即 getSuggetion 方法返回的提示）插入到缓冲区时被调用。可选
  onDidInsertSuggestion({editor, suggestion}) {
    (suggestion.type === 'property') && setTimeout(() => this.triggerAutocomplete(editor), 1);
  },

  triggerAutocomplete(editor) {
    atom.commands.dispatch(atom.views.getView(editor), 'autocomplete-plus:activate', {activatedManually: false});
  },

  isAttrStart({editor, scopeDescriptor, bufferPosition, prefix}) {
    const preTwoLetter = editor.getTextInBufferRange([[bufferPosition.row, bufferPosition.column - 2], bufferPosition]);
    const scopes = scopeDescriptor.getScopesArray();
    if (!this.getPreAttr(editor, bufferPosition) && ((prefix && !prefix.trim())|| this.bindReg.test(preTwoLetter) || this.methodReg.test(preTwoLetter))) {
      return this.hasTagScope(scopes);
    }

    const preBufferPosition = [bufferPosition.row, Math.max(0, bufferPosition.column - 1)];
    const preScopeDescriptor = editor.scopeDescriptorForBufferPosition(preBufferPosition);
    const preScopes = preScopeDescriptor.getScopesArray();

    if (preScopes.includes('entity.other.attribute-name.html')) {
      return true;
    }
    if (!this.hasTagScope(scopes) || !prefix) {
      return false;
    }
    return (scopes.includes('punctuation.definition.tag.end.html') &&
          !preScopes.includes('punctuation.definition.tag.end.html'));
  },

  isAttrValueStart({scopeDescriptor, bufferPosition, editor}) {
    // 获取作用域描述符字符串数组， 形如 ['text.html.vue', 'meta.tag.other.html', 'string.quoted.double.html', 'punctuation.definition.string.end.html']
    const scopes = scopeDescriptor.getScopesArray();
    // 获取当前位置的前一个字符位置
    const preBufferPosition = [bufferPosition.row, Math.max(0, bufferPosition.column - 1)];
    // 获取前一个字符位置的作用域描述符
    const preScopeDescriptor = editor.scopeDescriptorForBufferPosition(preBufferPosition);
    // 获取作用域描述符字符串数组
    const preScopes = preScopeDescriptor.getScopesArray();

    // 当前鼠标位置 and 前一个位置（这个里主要是判断 attr= 再输入 ' 或 " 这种情况）是包含在字符串作用域中 and 前一个字符不能是字符串定义结束字符（' or "）为真，就说明是开始输入属性值
    return (this.hasStringScope(scopes) &&
      this.hasStringScope(preScopes) &&
      !preScopes.includes('punctuation.definition.string.end.html') &&
      this.hasTagScope(scopes) &&
      this.getPreAttr(editor, bufferPosition)
    );
  },

  isTagStart({editor, bufferPosition, scopeDescriptor, prefix}) {
    if (prefix.trim() && !prefix.includes('<')) {
      return this.hasTagScope(scopeDescriptor.getScopesArray());
    }
    // autocomplete-plus's default prefix setting does not capture <. Manually check for it.
    prefix = editor.getTextInBufferRange([[bufferPosition.row, bufferPosition.column - 1], bufferPosition]);
    const scopes = scopeDescriptor.getScopesArray();
    console.log(prefix, scopes[0]);
    return (prefix === '<' &&
      ((scopes.includes('text.html.basic') && scopes.length === 1) ||
      (scopes.includes('text.html.vue') && scopes.includes('invalid.illegal.bad-angle-bracket.html'))));
  },
  // 获取当前输入位置存在的属性名
  getPreAttr(editor, bufferPosition) {
    // 初始引号的位置
    let quoteIndex = bufferPosition.column - 1;
    // 引号的作用域描述符
    let preScopeDescriptor = null;
    // 引号的作用域描述符字符串数组
    let scopes = null;
    // 在当前行循环知道找到引号或索引为 0
    while (quoteIndex) {
      // 获取位置的作用描述符
      preScopeDescriptor = editor.scopeDescriptorForBufferPosition([bufferPosition.row, quoteIndex]);
      scopes = preScopeDescriptor.getScopesArray();
      // 当前位置不在字符串作用域内或为引号起始位置， 则跳出循环
      if (!this.hasStringScope(scopes) || scopes.includes('punctuation.definition.string.begin.html')) {
        break;
      }
      quoteIndex--;
    }
    // 属性名匹配正则表达
    let attr = this.attrReg.exec(editor.getTextInRange([[bufferPosition.row, 0], [bufferPosition.row, quoteIndex]]));
    return attr && attr[1];
  },

  getPreTag(editor, bufferPosition) {
    // 当前行
    let row = bufferPosition.row;
    // 标签名
    let tag = null;
    // 文件逐行向上遍历知道找到正则匹配的字符串，或 row = 0;
    while (row) {
      // lineTextForBufferRow 获取当前行文本字符串
      tag = this.tagReg.exec(editor.lineTextForBufferRow(row));
      if (tag && tag[1]) {
        return tag[1];
      }
      row--;
    }
    return;
  },

  getAttrValues(tag, attr) {
    let attrItem = this.getAttrItem(tag, attr);
    let options = attrItem && attrItem.options;
    if (!options && attrItem) {
      if (attrItem.type === 'boolean') {
        options = ['true', 'false'];
      } else if (attrItem.type === 'icon') {
        options = ATTRS['icons'];
      } else if (attrItem.type === 'shortcut-icon') {
        options = [];
        ATTRS['icons'].forEach(icon => {
          options.push(icon.replace(/^fa-/, ''));
        });
      }
    }
    return options || [];
  },

  getTagAttrs(tag) {
    return (TAGS[tag] && TAGS[tag].attributes) || [];
  },

  getTagSuggestion({editor, bufferPosition, prefix}) {
    // editor： 当前的文本编辑上下文
    // bufferPosition：当前光标的位置，包含属性 row 和 column。
    // scopeDescriptor: 当前光标位置所在的作用域描述符，可通过其 .getScopesArray 方法获取到包含所有自己和祖先作用域选择器的数组。你可以通过按 cmd+shift+p 打开命令面板输入 Log Cursor scope 来查看作用描述符。
    // prefix：当前光标输入位置所在单词的前缀，注意 autocomplete+ 不会捕获 ‘<’， ‘@’ 和 ‘:’ 字符，所以后面我们得自己做处理。原来没有仔细阅读文档（衰），我发现我原来实现的方法比较局限，其实这里教你怎么定义自己的 prefix 了
    const preLetter = editor.getTextInBufferRange([[bufferPosition.row, bufferPosition.column - 1], bufferPosition]);
    const suggestions = [];
    for (let tag in TAGS) {
      if (preLetter === '<' || this.firstCharsEqual(tag, prefix)) {
        suggestions.push(this.buildTagSuggestion(tag, TAGS[tag]));
      }
    }
    return suggestions;
  },

  getAttrSuggestion({editor, bufferPosition, prefix}) {
    const suggestions = [];
    const tag = this.getPreTag(editor, bufferPosition);
    const tagAttrs = this.getTagAttrs(tag);
    const preText = editor.getTextInBufferRange([[bufferPosition.row, 0], bufferPosition]);

    tagAttrs.forEach(attr => {
      // autocomplete-plus会忽略@和<符号
      // 属性存在 and 为空 or 绑定元素（' :') or 首字母相等
      const attrItem = this.getAttrItem(tag, attr);
      if (attrItem && (!prefix.trim() || this.bindReg.test(prefix) || this.firstCharsEqual(attr, prefix))) {
          const sug = this.buildAttrSuggestion({attr, tag}, attrItem);
          sug && suggestions.push(sug);
      }
    });
    for (let attr in ATTRS) {
      const attrItem = this.getAttrItem(tag, attr);
      if (attrItem && attrItem.global && (!prefix.trim() || this.bindReg.test(prefix) || this.firstCharsEqual(attr, prefix))) {
        const sug = this.buildAttrSuggestion({attr}, attrItem);
        sug && suggestions.push(sug);
      }
    }
    return suggestions;
  },

  getAttrValueSuggestion({editor, bufferPosition, prefix}) {
    // 存放提示信息对象数据
    const suggestions = [];
    // 获取当前所在标签名
    const tag = this.getPreTag(editor, bufferPosition);
    // 获取当前所在属性名称
    const attr = this.getPreAttr(editor, bufferPosition);
    // 获取当前所在标签属性名下的属性值
    const values = this.getAttrValues(tag, attr);
    // 属性值数组进行格式化处理
    values.forEach(value => {
      if (this.firstCharsEqual(value, prefix) || !prefix) {
        suggestions.push(this.buildAttrValueSuggestion(tag, attr, value));
      }
    });
    // 返回符合 autocompete+ 服务解析的数据结构数组
    return suggestions;
  },

  // 对原始数据加工处理
  buildAttrSuggestion({attr, tag}, {description, type}) {
    const attrItem = this.getAttrItem(tag, attr);
    return {
      snippet: (type && (type === 'flag')) ? `${attr} ` : `${attr}=\"$1\"$0`,
      displayText: attr,
      type: (type && (type === 'method')) ? 'method' : 'property',
      description: description,
      rightLabel: tag ?  `<${tag}>` : 'ZCMS'
    };
  },

  // 对原始数据加工处理
  buildAttrValueSuggestion(tag, attr, value) {;
    const attrItem = this.getAttrItem(tag, attr)
    // 返回 suggestion 对象 具体格式说明请看：https://github.com/atom/autocomplete-plus/wiki/Provider-API#suggestions
    return {
      text: value,
      type: 'value',
      description: attrItem.description,
      rightLabel: attrItem.global ? 'ZCMS' : `<${tag}>`
    };
  },

  buildTagSuggestion(tag, tagVal) {
    const snippets = [];
    let index = 0;
    function build(tag, {subtags, defaults}, snippets) {
      let attrs = '';
      defaults && defaults.forEach((item,i) => {
        attrs +=` ${item}="$${index + i + 1}"`;
      });
      snippets.push(`${index > 0 ? '<':''}${tag}${attrs}>`);
      index++;
      subtags && subtags.forEach(item => build(item, TAGS[item], snippets));
      snippets.push(`</${tag}>`);
    };
    build(tag, tagVal, snippets);

    return {
      displayText: tag,
      snippet: prettyHTML('<' + snippets.join('')).substr(1),
      type: 'tag',
      rightLabel: 'ZCMS',
      description: tagVal.description
    };
  },

  // scopes 是否包含单引号和双引号作用域选择器来决定是否在字符串中
  hasStringScope(scopes) {
    return (scopes.includes('string.quoted.double.html') ||
      scopes.includes('string.quoted.single.html'));
  },
  // scopes 是否存在标签（tag）的作用域选择器来决定是否在标签作用域内，这里也是存在多种 tag 作用域选择器
  hasTagScope(scopes) {
    return (scopes.includes('meta.tag.any.html') ||
      scopes.includes('meta.tag.other.html') ||
      scopes.includes('meta.tag.block.any.html') ||
      scopes.includes('meta.tag.inline.any.html') ||
      scopes.includes('meta.tag.structure.any.html'));
  },

  firstCharsEqual(str1, str2) {
    if (str2 && str1) {
      return str1[0].toLowerCase() === str2[0].toLowerCase();
    }
    return false;
  },

  getAttrItem(tag, attr) {
    return ATTRS[`${tag}/${attr}`] || ATTRS[attr];
  },
  // provider 销毁后的善后工作，可选
  dispose() {
  }

};

export default provider;
