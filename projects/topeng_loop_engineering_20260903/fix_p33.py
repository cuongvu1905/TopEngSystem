import glob, re

# Fix P33.svg
with open('svg_output/P33.svg', 'r', encoding='utf-8') as f:
    text = f.read()
text = re.sub(r'font-size="52"', 'font-size="42"', text)
with open('svg_output/P33.svg', 'w', encoding='utf-8') as f:
    f.write(text)
print('P33.svg font size fixed')
