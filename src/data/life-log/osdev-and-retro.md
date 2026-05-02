---
title: "Of OS dev, hedgehogs, and RISC OS"
date: "2026-05-02"
byline: "Chris Williams"
permalink: "osdev-and-retro.html"
summary: "Why writing an OS is still hard, and retro computing is still wild."
---

I spend my day job looking at planet-scale infrastructure and its users, so naturally, in my off-hours, my brain decides it's the perfect time to think about MMU page table setups and retro computing.

## AI-assisted OS development

If you've been casually browsing the latest crop of AI-generated hobby operating systems popping up on Reddit's [/r/osdev](https://www.reddit.com/r/osdev/new), you might think slapping together an OS is just a matter of prompting a language model nicely. I get it: I've always wanted to peer inside seemingly forbidden or daunting systems, like operating system kernels or games console firmware and hardware. When you find out how it all works, you feel compelled to replicate it for yourself one way or another.

As [copy.fail](https://copy.fail/) ([CVE-2026-31431](https://www.cve.org/CVERecord?id=CVE-2026-31431)) helpfully reminds us, though, writing an OS remains objectively tricky and profoundly hard.

Getting CPU segmentation and page table setups right is a mysterious art, and the authors of these shiny new AI-assisted kernels, let alone the developers of today's mature kernels, need to worry about security and edge cases. I mean, if the mighty, battle-hardened Linux kernel can still fall victim to local-privilege-escalation bugs, your weekend project probably has a hole big enough to drive a virtual truck through.

I don't mean that as a harsh criticism or dissuasion. Far from it: I wish more people understood how microprocessors and operating systems work and the security mechanisms they depend upon. I think these AI-assisted projects are a potentially fantastic way to learn.

That said, security is still something to take seriously, even when we're just building things for ourselves, our friends, or our communities.

## Retro computing

Speaking of doing things the hard way, I have to hand it to [Reassembler](https://www.youtube.com/@reassembler68k) for getting [Sonic the Hedgehog running on Amiga hardware](https://www.youtube.com/watch?v=nWqK44j0Zps). Seeing as the Amiga is bitplane-based, which I've never fully gotten my head around, getting sprite-based Sonic running on it is no small feat.

Also hat tip to [Displaced Gamers](https://www.youtube.com/@DisplacedGamers) for their [breakdown](https://youtu.be/O_CLnBCgJks) of Final Fantasy's combat system for the Famicom and the NES. The original game was completely playable, arguably groundbreaking, but [bug-ridden](https://finalfantasy.fandom.com/wiki/List_of_bugs_and_glitches).

Not surprising since it was basically one programmer cranking out 6502 assembly on a deadline. That developer is Nasir Gebelli, who [recently resurfaced](https://www.gamesradar.com/games/final-fantasy/original-final-fantasy-programmer-reappears-after-years-of-silence-casually-says-writing-his-legendary-code-was-pretty-simple-and-it-could-even-be-better/). I recommend checking out the 1998 and 2017 [interviews](https://www.reddit.com/r/Games/comments/9o53sp/nasir_gebelli_3_hour_long_interview_final_fantasy/) with John "id Software" Romero and Nasir Gebelli. They're amazing and fascinating.

## RISC OS

And then there's [Gerph](https://gerph.org/), who is out there [modernizing RISC OS development](https://www.youtube.com/@gerphy/videos) and bringing the original Arm-based OS to 64-bit. It's inspiring stuff, and a good reminder that there are still interesting things happening in the world of OS dev.

For more information, see the [Pyromaniac](https://pyromaniac.riscos.online/) site. I should do a more in-depth look at this OS soon.