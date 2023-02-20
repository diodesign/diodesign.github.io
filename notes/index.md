---
layout: base
title: "Notes and thoughts"
description: "Technical notes and other personal observations"
---

## Notes and thoughts
This is the notes index page. These are the latest posts.

{% for post in site.posts limit: 10 %}
  -
  <a href="{{ post.url }}">{{ post.title }}</a>
{% endfor %}

To browse all notes, dive into the archive organized [by date](all-by-date/) or [by tag](all-by-tag/).