import BlogPostCard from '@/layouts/components/BlogPostCardNext'
import defaultCoverImage from '@/data/defaultCoverImage'
import { Layout } from '@/layouts'
import { getCanonicalPageId } from '@/lib/get-canonical-page-id'
import getIcon from '@/lib/get-icon'
import { PageProps } from '@/lib/types'
import cover from '@/public/images/city.webp'
import config from '@/site.config'
import { domain } from '@/lib/config'
import { mapImageUrl } from 'lib/map-image-url'
import { resolveNotionPage } from 'lib/resolve-notion-page'
import {
  getBlockIcon,
  getBlockTitle,
  getPageProperty,
  normalizeUrl,
  parsePageId,
} from 'notion-utils'

export const getStaticProps = async () => {
  try {
    const props = (await resolveNotionPage(domain)) as PageProps & {
      postList: any[]
      tagSchema: any
    }
    if (props.error) {
      throw props.error
    }
    const collectionId = parsePageId(config.postsCollectionId)
    const recordMap = props.recordMap
    const getUrl = (pageId) =>
      getCanonicalPageId(parsePageId(pageId, { uuid: true }), recordMap, {
        uuid: process.env.NODE_ENV && process.env.NODE_ENV === 'development',
      })
    const schema = recordMap.collection?.[collectionId]?.value?.schema
    const tagSchemaOptions = Object.values(schema).find(
      (x) => x.name === 'Tags'
    ).options
    const tagColorMap = Object.fromEntries(
      tagSchemaOptions.map((x) => [x.value, x.color])
    )

    const postList = Object.entries(props.recordMap.block)
      .map(([id, { value: block }]) => {
        if (parsePageId(block?.parent_id) !== collectionId) return false
        const isPublic = getPageProperty<boolean>('Public', block, recordMap)
        if (!isPublic) return false

        const title = getBlockTitle(block, props.recordMap)
        const icon = getIcon(getBlockIcon(block, props.recordMap), block)

        const description = getPageProperty<string>(
          'Description',
          block,
          recordMap
        )
        const tags = getPageProperty<string[]>(
          'Tags',
          block,
          recordMap
        )?.filter?.((t) => t && t.length > 0)
        const date =
          getPageProperty<number>('Published', block, recordMap) ??
          block.created_time
        const coverImageSrc = mapImageUrl(block?.format?.page_cover, block)

        const coverImage = coverImageSrc
          ? {
              src: coverImageSrc,
              ...(recordMap?.preview_images?.[coverImageSrc] ??
                recordMap?.preview_images?.[normalizeUrl(coverImageSrc)]),
            }
          : defaultCoverImage

        return {
          id,
          collectionId,
          title,
          icon,
          coverImage,
          tags: tags.map((t) => ({
            name: t,
            color: tagColorMap[t],
          })),
          date,
          block,
          description,
          url: getUrl(id),
        }
      })
      .filter(Boolean)
      // @ts-ignore
      .sort((a, b) => b?.date - a?.date)

    props.postList = postList

    return { props, revalidate: 10 }
  } catch (err) {
    console.error('page error', domain, err)

    // we don't want to publish the error version of this page, so
    // let next.js know explicitly that incremental SSG failed
    throw err
  }
}

export default function NotionDomainPage(props) {
  return (
    <Layout
      {...props}
      title={props.site.name}
      description={props.site.description}
      coverImage={{
        src: cover,
      }}
    >
      <div className='container grid grid-cols-1 gap-4'>
        {props.postList.map((post, index) => (
          <BlogPostCard key={post.id} isEnd={index === props.postList.length - 1} {...post} />
        ))}
      </div>
    </Layout>
  )
}
