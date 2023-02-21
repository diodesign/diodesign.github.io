---
layout: base
title: "Notes and thoughts"
description: "Technical notes and other personal observations"
---

## Notes and thoughts
This is the notes index page. These are the latest posts.

{% for post in site.posts limit: 10 %}
  - [{{ post.title }}]({{ post.url }})
{% endfor %}

To browse all notes, dive into the archive organized [by date](all-by-date/) or [by tag](all-by-tag/).