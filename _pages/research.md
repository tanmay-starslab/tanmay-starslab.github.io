---
layout: archive
title: "Research"
permalink: /research/
author_profile: true
header:
  overlay_image: galaxy2.jpg
---

{% include base_path %}


# Overview
<!-- <figure>
<p style="text-align: center;">
<figcaption>Gas flows in the CGM (simulation from Lochhaas et al. 2021, left and Peeples et al. 2015, right).</figcaption>
</p>
<p float="left">
  <img src="/images/cgm/cgm_flows.jpg" style="width:50%; border:1;">
  <img src="/images/cgm/cgm_ARAA_Nature15_peeples.jpg" style="width:45%; border:1;">
</p>
</figure>

Broadly speaking, I study how galaxies form and evolve using observational tools. Understanding the physical processes that form the galaxies and set their evolution has been one of the central problems in astronomy. With the advent of advancements in computer simulations combined with powerful telescopes, we have slowly started to uncover the hidden mysteries of our vast universe. Recent large scale cosmological simulations have revealed that the galaxies are surrounded by a diffuse gaseous halo, known as the [circumgalactic medium (CGM)](https://www.annualreviews.org/doi/10.1146/annurev-astro-091916-055240). The interplay between different gas flows (outflows and inflows also knows as the cosmic baryon cycle) in this invisible medium is the key to a clear and accurate picture of the fate of galaxies. In a broader sense, I want to understand the -
  * physical processes that govern the galaxy formation and evolution.
  * the complex nature of the gas flows in the CGM and how do they depend on and impact the galaxy - - properties and its environment.
  * methods and techniques required to analyse the large datasets coming from various telescopes.

## Cosmic Baryon Cycle
In simple terms, the ["cosmic baryon cycle"](https://arxiv.org/abs/2011.01935) is very similar to how evaporation and rain work on the earth. We all know that the sun heats the water on earth which evaporates and goes up where it condenses and forms clouds which in turn shower rain on earth. This process continues, and we call it the water cycle in hydrology. Similarly, the pristine gas (mostly hydrogen and helium) is accreted (also known as the inflow) by the galactic halo (CGM), where it forms gaseous clouds (a very complex physical mechanism) which falls on the galactic disk where it is turned into stars. Finally, these stars release a lot of energy via supernovae or stellar winds, which kick gas out of the galaxy into the halo (CGM) (known as the galactic outflows). This process also makes the CGM very multiphase, where gases with different temperatures and densities compete. Will the galaxy continue getting fuel and forming new stars, or will it stop forming stars, depending on the balance between these gas flows? However, predicting or fully understanding the fate of galaxy formation is very challenging!


## Multiphase Circumgalactic Medium in Observations
As described above, the CGM plays a pivotal role in galaxy formation but it is very challenging to study it observationally. The CGM is very diffuse (having low densities, $n\sim 10^{-3} \,cm^{-3}$, for comparison air density on earth is about $10^{19} \,cm^{-3}$) and the temperature can range from $\sim 10^4\, K$ to $10^7\, K$, therefore it is excidingly hard to observe in emission as emission flux is directly proportional to the gas density. However, with the advent of groundbreaking space and ground based telescopes it can be studied in absorption against a bright background object.

In my PhD thesis, I explored the nature of the complex gas flows in the galaxies' circumgalactic medium (see figure at the top) using absorption lines detected in the spectra of background [Quasars](https://en.wikipedia.org/wiki/Quasar). My goal was to constrain the physical properties of these gas flows with the absorption lines that trace different phases in the CGM. [The setup is the following:](/images/cgm/my_cgm_process.png) when the light emanating from a bright background source (e.g., quasar) passes through the CGM of a foreground galaxy, it can get absorbed and cause absorption dips in the spectrum at redshifts smaller than the quasar redshift.  
  
The different absorption lines can trace [different phases](/images/cgm//absorber_phase.jpg) and physical processes in the CGM and help us understand their connection to galaxy properties and its environment. For e.g., MgII (Mg$^{+}$) and FeII (Fe$^{+}$) are tracers of the cold phase ($T \sim 10^4\, K$) of CGM, while CIV (C$^{3+}$) traces the warm-hot ($T \sim 10^5\,K$) CGM. In my project, I have explored the nature and origin of MgII absorbers in the CGM of star-forming and passive galaxies by characterizing their spatial distribution. Understanding the connection between this gas and the galactic properties and its environment does provide more insights into the physical processes governing galaxy formation and evolution.

**The cool circumgalactic medium of galaxies**

In [(Anand et al. 2021)](https://arxiv.org/abs/2103.15842), I used the largest quasar catalogue from the [SDSS Data Release 16 (DR16)](https://www.sdss.org/dr16/) to search for MgII absorbers in their spectra. Given large dataset (~ 1 million quasar spectra), I designed a novel automated pipeline to model the quasar continuum and search for MgII doublets in their spectra.  
<p float="center">
  <img src="/images/mgii_work/spec.png" style="width:80%; border:1; display:block”">
  <!-- <img src="/images/mgii_work/sfr_fc.jpg" style="width:45%; border:1; display:block”"> -->
  <figcaption>Quasar spectra (black) with NMF continuum (red) and detected MgII absorbers (Anand et al. 2021)</figcaption>
</p>

The pipeline uses a dimensional reduction technique called [Non-negative matrix factorization (NMF)](https://en.wikipedia.org/wiki/Non-negative_matrix_factorization), which reduces the quasar intrinsic emission features into eigenvalues and eigenspectra to model the quasar continuum. I developed an automated absorber detection pipeline using a matched kernel convolution technique and adaptive S/N criteria. The pipeline can run parallelly on several quasars at once to reduce the absorber search time. The detection algorithm was run on all quasars from SDSS DR16 and compiled the largest [MgII / FeII catalogue](https://wwwmpa.mpa-garching.mpg.de/SDSS/MgII/) available to date, which included ~160,000 systems. The figure on the right shows one example spectra with normalized flux (black) and NMF continuum (red), along with two MgII absorbers that our pipeline detects.

<p float="center">
  <img src="/images/mgii_work/mgii_covering_fraction.png" style="width:90%; border:1; display:block”">
  <!-- <img src="/images/mgii_work/sfr_fc.jpg" style="width:45%; border:1; display:block”"> -->
  <figcaption>Left: MgII covering fraction in the CGM of star-forming (blue) and passive galaxies (red). Right: MgII covering fraction within galactic halo as a function of star formation rate of galaxies. Both figures are from Anand et al. 2021</figcaption>
</p>

In the same work, I also connected MgII absorbers with CGM of [emission-line galaxies (ELGs or star-forming)](https://www.usm.uni-muenchen.de/people/saglia/praktikum/galspectra/node4.html) and [luminous red galaxies (LRGs or passive)](https://classic.sdss.org/dr2/products/general/edr_html/node53.html) from the SDSS DR16 to characterize the properties of cold gas in their CGM. With a very robust statistical analysis, our study implied that cool circumgalactic gas has a different physical origin for star-forming versus quiescent galaxies. We find that both MgII absorption and its covering fraction are 2 - 5 times higher in the CGM of ELGs than LRGs within ~ 50 kpc from the galaxy. Also, there is a very sharp decline in the covering fraction for both kinds of galaxies, and at large distances, they are within the error bars (see left Figure ). 
The rapid decline in the covering fraction at ~ 50 kpc implies that MgII properties are regulated by galactic outflows in the inner part of CGM, while it is tightly linked with the dark matter halo in outer regions.
We also find that the stellar activity of ELGs play a very important role in enriching their CGM, where the MgII covering fraction correlates strongly with the star formation activity (SFR) of the galaxy (see right Figure). In addition, we also see that MgII is rarely detected in the massive halos. The relative line-of-sight (LOS) velocity analysis also supports an outflow origin of MgII gas in ELGs, where the velocity dispersion of absorbing cloud relative to the halo is similar to the virial velocity of the dark matter halo. On the other hand, it is suppressed by 40-50 % in the LRGs, suggesting a different origin of MgII gas in their halo, possibly accretion or stripping from neighbouring halo. To summarize, our analysis combined with previous studies implied that cool circumgalactic gas has a different physical origin for star-forming versus quiescent galaxies.

**The cool metal gas in galaxy clusters**

In [Anand et al. 2022](https://arxiv.org/abs/2201.07811), I extended the MgII absorber study to the galaxy clusters. In this high mass regime (see Figure on left) we have the potential to shed light on the role of environment in shaping the CGM of galaxies. Cluster halo gas known as the [intracluster medium (ICM)](https://en.wikipedia.org/wiki/Intracluster_medium) is heated up to high temperatures ($T \sim 10^7 - 10^8$ K) due to gravitational collapse. In addition, outflows powered by supermassive black holes in the centre of clusters can also heat the gas. The hot ICM emits mostly at X-ray wavelengths due to radiation from thermal [bremsstrahlung](https://en.wikipedia.org/wiki/Bremsstrahlung) produced in the highly ionized gas. Although the ICM is hot, cold/cool gas has sometimes been detected in and around clusters. The most frequently observed elements are hydrogen (Hα, Lyα) and metal absorption lines (MgII, OVI), which are detected in the spectra of background quasars.

The absorber - cluster cross-correlation study using our MgII absorber catalogue and galaxy clusters from the legacy survey imaging of [Dark Energy Spectroscopic Instrument (DESI)](https://en.wikipedia.org/wiki/Dark_Energy_Spectroscopic_Instrument) [data release (DR8)](https://www.legacysurvey.org/dr8/description/) is one of the most extensive such studies to date, with $160,000$ MgII absorbers and $72,000$ clusters with spectroscopic redshifts. I characterized the nature and origin of MgII absorbers in galaxy clusters, where most of the [intracluster medium (ICM)](https://en.wikipedia.org/wiki/Intracluster_medium) is mainly filled with hot plasma ($T\sim 10^7$ K). 

<p float="left">
  <img src="/images/cluster_work/mgii_surf_dens.png" style="width:45%; border:1; display:block”">
  <img src="/images/cluster_work/ew_vs_sfr.png" style="width:45%; border:1; display:block”">
  <figcaption>Left: MgII surface density around galaxy clusters. Right: Equivalent width as a function of star formation rate of cluster galaxies Both figures are from Anand et al. 2021</figcaption>
</p>

Despite the hot ICM, our analysis shows a significant covering fraction ($3-5\%$) of cold gas ($T \sim 10^4$, traced by MgII absorbers) in cluster environments on virial scales. On the other hand, the surface mass density (see Figure on left) of MgII absorbers is $2-3$ times higher in clusters than luminous red galaxies (LRGs). However, the surface mass density is $5-10$ lower than emission-line galaxies (ELGs). While the covering fraction of cool gas in clusters decreases with increasing mass of the central galaxy, the total MgII mass within $r_{500}$ is nonetheless $\sim 10$ times higher than for SDSS LRGs. The MgII covering fraction/surface mass density versus impact parameter is well described by a power law in the inner regions and an exponential function at larger distances. The characteristic scale of the transition between these two regimes is smaller for large [equivalent width](https://en.wikipedia.org/wiki/Equivalent_width) absorbers ($EW > 1Å$), implying different origin of weak and strong absorbers in dense environments.

Furthermore, I also investigated the connection between MgII absorbers and the member galaxies of the cluster. Cross-correlating MgII absorption with photo -z selected cluster member galaxies from DESI reveals a statistically significant connection. The median projected distance between MgII absorbers and the nearest cluster member is $\sim200$ kpc, compared to $\sim 500$ kpc in random mocks with the same galaxy density profiles. We do not find a correlation between MgII strength and the star formation rate of the closest cluster neighbour (See figure on right). This suggests that cool gas in clusters, as traced by MgII absorption, is: (i) associated with satellite galaxies, (ii) dominated by cold gas clouds in the intracluster medium, rather than by the interstellar medium of galaxies, and (iii) may originate in part from gas stripped from these cluster satellites in the past.

**The cool/warm multiphase metal gas in quasar haloes**

I am also looking into the nature of warm (traced by CIV absorbers) and cool gas (traced by MgII absorbers) in [quasar](https://en.wikipedia.org/wiki/Quasar) haloes <span style="color:blue">(Anand+ in prep.)</span>. As the physical properties of quasars are very different (due to the presence of central [active galactic nuclei (AGN)](https://en.wikipedia.org/wiki/Active_galactic_nucleus)) from the normal galaxies, the differences must be visible in the properties of gas around them. Also they can be observed upto very large distances (or redshifts), hence can prove to be a great candidate to understand the evolution gas around galaxies at different redshifts in the universe.

## New methods of galaxy spectral fitting for redshift estimation

With the advent of ongoing large spectroscopic surveys, it has increasingly become important to analyze large numbers of astronomical spectra and measure their redshifts. As we move towards precision cosmology, getting precise redshift measurements of galaxies and quasars is extremely important for all cosmological surveys. In recent years, surveys like DESI have started taking unprecedented amounts of astronomical spectra to perform a next-generation cosmological analysis. Measuring their precise redshifts is one of the outstanding challenges we face. It is impossible to inspect millions of spectra and get the best redshift visually; therefore, we have to rely on dimensional reduction techniques and model the spectra of those objects. One of the extensively used approaches is the principal component analysis (PCA), which reduces a large set of features into their principal components (orthogonal eigenvectors) and constructs them with a linear combination of these features. PCA is exceptionally computationally efficient and fast; however, it suffers from the fact that it does not use any physical features of those astronomical objects. This often results in unphysical modelling or overfitting of the input spectra.

In my current work <span style="color:blue">(Anand+ in prep.)</span>, I am trying to combine the PCA speed and efficiency with an algorithm that uses a set of physical parameters of astronomical objects to deal with such overfitting or unphysical fitting where PCA fails. For this, I have been working on generating synthetic galaxy spectra (also known as archetypes) and then using PCA to run with those physical spectra and model the observed spectra. Though it is slower than the classic PCA, it resolves the problems of unphysical models and overfitting. This method is extremely useful for DESI and upcoming spectroscopic surveys such as 4MOST and WEAVE. The [github repository](https://github.com/desihub/redrock) details out the algorithm and code. 


## Past research insterests and projects

In my Undergraduate, I have worked on a few other topics in astronomy. In addition to that, I also explored some topics in high energy physics and computational nonlinear dynamics. I still like those topics and would love to explore them in future. You can find more about my past projects [here](/pages/pastprojects).
 -->
