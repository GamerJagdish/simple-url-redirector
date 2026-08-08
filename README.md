<div align="center">
	<a href="https://gamerjagdish.github.io/simple-url-redirector/">
		<img src="icons/icon1280.png" width="200" alt="simple-url-redirector">
	</a>
</div>

# Simple URL Redirector (Browser Extension)

Automatically redirects links from one URL to another, based on rules you define. For example, `redditez.com` to `reddit.com`.

<p align="center">
  <a href="https://github.com/GamerJagdish/simple-url-redirector/releases/latest/"><img alt="Latest Release" src="https://img.shields.io/github/v/release/GamerJagdish/simple-url-redirector?display_name=release&style=flat-square"></a>
  <a href="https://github.com/GamerJagdish/simple-url-redirector/commits"><img alt="Last Commit" src="https://img.shields.io/github/last-commit/GamerJagdish/simple-url-redirector?style=flat-square"></a>
  <a href="https://github.com/GamerJagdish/simple-url-redirector/stargazers"><img alt="Stargazers" src="https://img.shields.io/github/stars/GamerJagdish/simple-url-redirector?style=flat-square"></a>
  <a href="LICENSE"><img alt="License: GPLv3" src="https://img.shields.io/github/license/GamerJagdish/simple-url-redirector?style=flat-square"></a>
</p>

It works two ways at once:
- Navigation-level redirect via `declarativeNetRequest`: if you click or type a link to a matching URL, your browser redirects you straight to the target URL, preserving the path, query, and fragment.
- On-page rewriting via a content script: links already displayed on a page get their `href` rewritten too, so hovering, copying, or middle-clicking shows the correct destination.

## Screenshots

<p align="center">
  <img src="screenshots/simple-url-redirector-screenshot.png" alt="Simple URL Redirector popup and rule editor" width="400" />
  <img src="screenshots/simple-url-redirector-full-view-screenshot.png" alt="Simple URL Redirector full view" width="800" />
</p>

## Installation

### Microsoft Edge

You can install the extension directly from the [Microsoft Edge Add-ons Store](https://microsoftedge.microsoft.com/addons/detail/simple-url-redirector/mmikmpmhfhkijbbcjianpbegaefeaiio).

### Mozilla Firefox
<div>
	<a href="https://addons.mozilla.org/en-US/firefox/addon/simple-url-redirect/" target='_blank'>
		<img src="https://i.postimg.cc/47pqX976/Firefox-Add-ons.png" width="200" alt="Simple URL Redirector Firefox-Add-ons">
	</a>
</div>

You can install the extension directly from the [Firefox Browser Add-ons Store](https://addons.mozilla.org/en-US/firefox/addon/simple-url-redirect/).

### Manual Installation (Chrome, Chromium-based browsers)

1. Click download below to get the zip file.
2. [![Simple URL Redirector](https://img.shields.io/github/release/gamerjagdish/simple-url-redirector.svg?maxAge=3600&display_name=release&label=Download%20Extension&labelColor=06599d&color=043b69&style=for-the-badge)](https://github.com/gamerjagdish/simple-url-redirector/releases)
3. Unzip this folder somewhere permanent (don't delete it after installing; Chrome loads it from disk).
4. Open `chrome://extensions` in Chrome.
5. Turn on Developer mode (top right).
6. Click Load unpacked and select the `simple-url-redirector` folder.
7. Click the extension icon in your toolbar to add and manage rules.

## Adding a rule

In the popup or options page, enter:
- From: `redditez.com`
- To: `reddit.com`

And click Add rule. From then on, `https://www.redditez.com/r/ProgrammerHumor/s/KlACnhZGrB` becomes `https://www.reddit.com/r/ProgrammerHumor/s/KlACnhZGrB`.

Add as many rules as you like. Each rule has its own on/off toggle, and there's a master switch in the popup to pause all redirects at once.

## Simple vs Advanced Rules

Simple rules match whole domains, ignoring leading `www.`.

Advanced rules use regex for more flexibility. Use regex rules let you match complex patterns and use substitution groups.

## Support

If you find this project useful, consider supporting:

<br/>

<a href="https://www.buymeacoffee.com/gamerjagdish" target="_blank" title="buymeacoffee">
  <img src="https://iili.io/JoQ1MeS.md.png" alt="buymeacoffee-yellow-badge" style="width: 204px;">
</a>
<br/>
<a href="https://www.ko-fi.com/gamerjagdish" target="_blank" title="ko-fi">
  <img src="https://iili.io/qHFVi5Q.md.png" alt="ko-fi-badge" style="width: 304px;">
</a>
