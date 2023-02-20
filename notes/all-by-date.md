---
layout: base
title: "All notes by date"
description: "All technical notes and other personal observations listed by date"
---

## Notes
This is the notes all-by-date page. Notes are also [sorted by tag](../all-by-tag/).

{% assign grouped_by_year = site.posts | group_by_exp: "post", "post.date | date: '%Y'" %}
{% for year in grouped_by_year %}
  {% assign grouped_by_month = year.items | group_by_exp: "post", "post.date | date: '%B'" %}
  {% for month in grouped_by_month %}
*{{ month.name }} {{ year.name }}*
    {% for post in month.items %}
  - [{{ post.title }}]({{ post.url }})
    {% endfor %}
  {% endfor %}
{% endfor %}